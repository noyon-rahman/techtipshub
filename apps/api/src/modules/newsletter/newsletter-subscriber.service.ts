import httpStatus from "http-status";
import mongoose from "mongoose";
import { isEmailConfigured } from "../../config";
import { newsletterWelcomeMessage } from "../../emails";
import AppError from "../../errors/AppError";
import sendEmail from "../../utils/sendEmail";
import { adminLogService } from "../admin/admin-log.service";
import User from "../user/user.model";
import NewsletterSubscriber from "./newsletter.model";
import type {
  INewsletterSubscriber,
  TNewsletterSource,
} from "./newsletter.interface";
import { normalizeEmail, unsubscribeUrl } from "./newsletter.tokens";

export type TSubscribeInput = {
  name: string;
  email: string;
  source: TNewsletterSource;
};

/** Display names travel into a mail header, so line breaks are not allowed. */
const cleanName = (name: string) => name.replace(/[\r\n]+/g, " ").trim();

/**
 * One person joins the list.
 *
 * Single opt-in, as chosen: the address is active the moment the form is
 * accepted, and the welcome mail is that receipt. Two cases are deliberately
 * quiet rather than errors, because a public form must not say who is on a
 * list:
 *
 *   - the address is already active: nothing new is written, the welcome is
 *     not sent twice, and the reader is told they are already in;
 *   - the address bounced or was marked as spam: it stays suppressed. Joining
 *     again is not a way back in, so the same friendly answer goes out and no
 *     mail does.
 */
const subscribe = async ({ name, email, source }: TSubscribeInput) => {
  if (!isEmailConfigured()) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Signups are closed right now. Please try again later.",
    );
  }

  const address = email.trim();
  const key = normalizeEmail(email);

  const existing = await NewsletterSubscriber.findOne({ emailKey: key });

  if (existing) {
    if (existing.status === "active") {
      return { status: "already-subscribed" as const };
    }

    if (existing.status === "bounced" || existing.status === "complained") {
      return { status: "suppressed" as const };
    }

    // An address that left is allowed back, but only by asking again: the
    // record is reused so its history stays in one place.
    existing.name = cleanName(name);
    existing.status = "active";
    existing.source = source;
    existing.consentAt = new Date();
    existing.unsubscribedAt = null;
    await existing.save();

    await sendWelcome(existing);

    return { status: "subscribed" as const };
  }

  const created = await NewsletterSubscriber.create({
    name: cleanName(name),
    email: address,
    emailKey: key,
    status: "active",
    source,
    consentAt: new Date(),
    user: await memberIdFor(key),
  });

  await sendWelcome(created);

  return { status: "subscribed" as const };
};

/** The member behind an address, when the same person also has an account. */
const memberIdFor = async (emailKey: string) => {
  const member = await User.findOne({ email: emailKey }).select("_id");
  return member?._id ?? null;
};

/**
 * The welcome mail never fails the signup: the address is on the list whether
 * or not the first message arrives, and the next campaign reaches it.
 */
const sendWelcome = async (subscriber: INewsletterSubscriber) => {
  try {
    const mail = await newsletterWelcomeMessage({
      name: subscriber.name,
      unsubscribeUrl: unsubscribeUrl(subscriber.emailKey),
    });

    await sendEmail({
      to: { name: subscriber.name, address: subscriber.email },
      sender: "newsletter",
      category: "newsletter-welcome",
      unsubscribeUrl: unsubscribeUrl(subscriber.emailKey),
      ...mail,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Newsletter welcome delivery failed:", error);
  }
};

/**
 * Remove an address. Safe to repeat: a link pressed twice, or a mailbox
 * client pre-fetching the URL, lands on the same quiet result.
 *
 * A bounced or complained address keeps that status. Unsubscribing cannot
 * undo a reputation problem, and neither state would mail it again anyway.
 */
const unsubscribe = async (
  emailKey: string,
  options: { adminEmail?: string } = {},
) => {
  const key = normalizeEmail(emailKey);

  const subscriber = await NewsletterSubscriber.findOne({ emailKey: key });
  if (!subscriber) {
    throw new AppError(httpStatus.NOT_FOUND, "That address is not on the list.");
  }

  if (subscriber.status === "bounced" || subscriber.status === "complained") {
    return { status: subscriber.status };
  }

  if (subscriber.status === "unsubscribed") {
    return { status: "unsubscribed" as const };
  }

  subscriber.status = "unsubscribed";
  subscriber.unsubscribedAt = new Date();
  await subscriber.save();

  if (options.adminEmail) {
    await adminLogService.record({
      adminEmail: options.adminEmail,
      action: "newsletter.unsubscribe",
      targetType: "newsletter",
      targetId: String(subscriber._id),
      summary: `Removed ${subscriber.email} from the newsletter`,
    });
  }

  return { status: "unsubscribed" as const };
};

/**
 * A bounce or a spam complaint from Resend. Both stop mail for good, which is
 * what keeps the sending domain deliverable for everyone else.
 */
const suppress = async (emailKey: string, reason: "bounced" | "complained") => {
  const key = normalizeEmail(emailKey);

  const subscriber = await NewsletterSubscriber.findOne({ emailKey: key });
  if (!subscriber) return { changed: false };
  if (subscriber.status === reason) return { changed: false };

  subscriber.status = reason;
  subscriber.suppressedAt = new Date();
  subscriber.suppressReason = reason;
  await subscriber.save();

  return { changed: true };
};

/**
 * The profile toggle. Turning it on subscribes the account's own address;
 * turning it off unsubscribes that same address. The list record is shared
 * with the public form, so a member who signed up on the site already sees
 * the switch on.
 */
const setMembership = async (email: string, subscribed: boolean) => {
  const key = normalizeEmail(email);

  const member = await User.findOne({ email: key });
  if (!member) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!subscribed) {
    // A member who was never on the list turning the switch off, or who has
    // already left, is not an error: the switch ends up off either way.
    const key = normalizeEmail(email);
    const existing = await NewsletterSubscriber.findOne({ emailKey: key });
    if (!existing || existing.status !== "active") return { subscribed: false };

    await unsubscribe(key);
    return { subscribed: false };
  }

  const existing = await NewsletterSubscriber.findOne({ emailKey: key });

  // A suppressed address cannot be switched back on from a profile either:
  // the mailbox already refused our mail, and asking it again damages the
  // sending domain.
  if (
    existing &&
    (existing.status === "bounced" || existing.status === "complained")
  ) {
    throw new AppError(
      httpStatus.CONFLICT,
      "We cannot add this address to the newsletter. Mail to it is being refused.",
    );
  }

  if (!existing) {
    if (!isEmailConfigured()) {
      throw new AppError(
        httpStatus.SERVICE_UNAVAILABLE,
        "Signups are closed right now. Please try again later.",
      );
    }

    const created = await NewsletterSubscriber.create({
      name: member.fullName,
      email: member.email,
      emailKey: key,
      status: "active",
      source: "profile",
      consentAt: new Date(),
      user: member._id,
    });

    await sendWelcome(created);

    return { subscribed: true };
  }

  existing.status = "active";
  existing.unsubscribedAt = null;
  existing.suppressedAt = null;
  existing.suppressReason = null;
  existing.user = member._id;
  if (!existing.name) existing.name = member.fullName;
  await existing.save();

  return { subscribed: true };
};

/**
 * What the profile screen reads: whether this member is on the list, and if
 * not, whether an address they cannot re-join exists (suppressed).
 */
const membershipOf = async (email: string) => {
  const key = normalizeEmail(email);
  const subscriber = await NewsletterSubscriber.findOne({ emailKey: key });

  return {
    subscribed: subscriber?.status === "active",
    status: subscriber?.status ?? null,
  };
};

const getById = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid subscriber id");
  }

  const subscriber = await NewsletterSubscriber.findById(id);
  if (!subscriber) {
    throw new AppError(httpStatus.NOT_FOUND, "Subscriber not found");
  }

  return subscriber;
};

const sendWelcomeById = async (id: string) => {
  const subscriber = await NewsletterSubscriber.findById(id);
  if (subscriber) await sendWelcome(subscriber);
};

export const subscriberService = {
  subscribe,
  unsubscribe,
  suppress,
  setMembership,
  membershipOf,
  getById,
  sendWelcomeById,
};
