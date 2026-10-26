import httpStatus from "http-status";
import type { Context } from "hono";
import config from "../../config";
import AppError from "../../errors/AppError";
import type { TAppBindings } from "../../interface/bindings";
import type { TRouteParams } from "../../interface/params";
import sendResponse from "../../utils/sendResponse";
import { subscriberAdminService } from "./newsletter-admin.service";
import { campaignService } from "./newsletter-campaign.service";
import { resendWebhook } from "./newsletter-webhook.service";
import { subscriberService } from "./newsletter-subscriber.service";
import { readUnsubscribeToken } from "./newsletter.tokens";
import { newsletterValidationSchema } from "./newsletter.validation";

const BROKEN_LINK =
  "This unsubscribe link is not valid. Check the link in your email, or reply to any edition and we'll remove you.";

/** The address a token was made for, or a 400 the page can show. */
const addressFor = (email: string, token: string) => {
  const verified = readUnsubscribeToken(email, token);
  if (!verified) throw new AppError(httpStatus.BAD_REQUEST, BROKEN_LINK);
  return verified;
};

/* -------------------------------------------------------------- public */

/**
 * The signup form.
 *
 * The answer says the request was taken and names what happens next, and that
 * is all it says: a public form is not a place to look up whether an address
 * is on the list, was refused, or belongs to someone. The two quiet outcomes
 * get the same words as a fresh signup.
 */
const subscribe = async (c: Context<TAppBindings>) => {
  const { name, email } = c.get("validatedBody");

  await subscriberService.subscribe({ name, email, source: "site" });

  return sendResponse(c, httpStatus.CREATED, {
    data: {
      message: "You're on the list. Check your inbox for a note from us.",
    },
  });
};

/**
 * The page an unsubscribe link opens. It only reports whose address the link
 * is for, so the reader sees who they are about to remove before pressing.
 */
const readUnsubscribeLink = async (c: Context<TAppBindings>) => {
  const { email, token } = c.get("validatedBody");

  return sendResponse(c, httpStatus.OK, {
    data: { email: addressFor(email, token) },
  });
};

/**
 * The link in every mail, and the one the profile switch calls for itself.
 *
 * Safe to repeat: a reader pressing twice, or a mailbox prefetching the URL,
 * asks for a state the address is already in and gets the same quiet answer.
 */
const unsubscribe = async (c: Context<TAppBindings>) => {
  const { email, token } = c.get("validatedBody");

  const verified = addressFor(email, token);
  const result = await subscriberService.unsubscribe(verified);

  return sendResponse(c, httpStatus.OK, {
    data: {
      email: verified,
      status: result.status,
      message:
        result.status === "unsubscribed"
          ? "You've been unsubscribed. You won't get the newsletter again."
          : "This address was already removed from the list.",
    },
  });
};

/**
 * Resend's bounce and complaint events.
 *
 * The body is verified as the text that arrived and only then parsed: Svix
 * signs the exact bytes it sent, so parsing first and re-serialising would
 * change them and fail every genuine call. A rejection answers 401, and Resend
 * retries a non-2xx, which is what a temporary outage needs.
 */
const resendEvents = async (c: Context<TAppBindings>) => {
  if (!config.RESEND_WEBHOOK_SECRET) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Webhooks are not configured on this server.",
    );
  }

  const raw = await c.req.text();

  const valid = resendWebhook.verifyResendSignature(raw, {
    id: c.req.header("svix-id") ?? "",
    timestamp: c.req.header("svix-timestamp") ?? "",
    signature: c.req.header("svix-signature") ?? "",
  });

  if (!valid) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid webhook signature.");
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AppError(httpStatus.BAD_REQUEST, "The event is not valid JSON.");
  }

  const parsed = newsletterValidationSchema.resendEvent.safeParse(body);

  // Signed, but not an event this list acts on. Acknowledged so Resend stops
  // retrying a delivery we will never use.
  if (!parsed.success) {
    return sendResponse(c, httpStatus.OK, {
      data: { handled: false, message: "Event ignored." },
    });
  }

  const result = await resendWebhook.handleResendEvent(parsed.data);

  return sendResponse(c, httpStatus.OK, { data: result });
};

/**
 * The scheduler's tick. Vercel Cron sends `Authorization: Bearer <secret>`; an
 * empty secret leaves the endpoint shut, and an admin drains the queue with
 * "Continue" instead.
 */
const cron = async (c: Context<TAppBindings>) => {
  const secret = config.CRON_SECRET;
  const given = c.req.header("authorization") ?? "";

  if (!secret || given !== `Bearer ${secret}`) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid cron credentials.");
  }

  const result = await campaignService.runQueue();

  return sendResponse(c, httpStatus.OK, { data: result });
};

/* --------------------------------------------------------------- member */

/**
 * The profile switch, both readings of it. Membership is the account's own
 * address on the same list the public form writes to, so a member who joined
 * from the site sees the switch on.
 */
const getMembership = async (c: Context<TAppBindings>) => {
  const result = await subscriberService.membershipOf(
    c.get("user").email ?? "",
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const setMembership = async (c: Context<TAppBindings>) => {
  const { subscribed } = c.get("validatedBody");

  const result = await subscriberService.setMembership(
    c.get("user").email ?? "",
    subscribed,
  );

  return sendResponse(c, httpStatus.OK, {
    data: {
      ...result,
      message: result.subscribed
        ? "You're on the list. Check your inbox for a note from us."
        : "You won't get the newsletter again.",
    },
  });
};

/* ---------------------------------------------------------------- admin */

const getAllSubscribers = async (c: Context<TAppBindings>) => {
  const { result, meta, counts } = await subscriberAdminService.getAll(
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, {
    meta,
    data: { result, meta, counts },
  });
};

const getSubscriber = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await subscriberAdminService.getSingle(id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const createSubscriber = async (c: Context<TAppBindings>) => {
  const result = await subscriberAdminService.create(
    c.get("validatedBody"),
    c.get("user").email,
  );

  return sendResponse(c, httpStatus.CREATED, { data: result });
};

/**
 * Admin removal. It takes the address rather than the row id because it is the
 * same act as the reader's own link, and goes through the same service.
 */
const unsubscribeSubscriber = async (c: Context<TAppBindings>) => {
  const { email } = c.get("validatedBody");

  const result = await subscriberService.unsubscribe(email, {
    adminEmail: c.get("user").email,
  });

  return sendResponse(c, httpStatus.OK, { data: result });
};

/**
 * The file itself rather than a JSON body. The date in the filename keeps two
 * downloads from colliding in a downloads folder.
 */
const exportSubscribers = async (c: Context<TAppBindings>) => {
  const csv = await subscriberAdminService.toCsv();
  const day = new Date().toISOString().slice(0, 10);

  c.header("Content-Type", "text/csv; charset=utf-8");
  c.header(
    "Content-Disposition",
    `attachment; filename="newsletter-subscribers-${day}.csv"`,
  );

  return c.body(csv, httpStatus.OK);
};

const listCampaigns = async (c: Context<TAppBindings>) => {
  const { result, meta } = await campaignService.list(c.req.query());

  return sendResponse(c, httpStatus.OK, { meta, data: { result, meta } });
};

const campaignSuggestion = async (c: Context<TAppBindings>) => {
  const result = await campaignService.suggestion();

  return sendResponse(c, httpStatus.OK, { data: result });
};

const getCampaign = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const [campaign, progress] = await Promise.all([
    campaignService.getById(id),
    campaignService.progress(id),
  ]);

  return sendResponse(c, httpStatus.OK, { data: { campaign, progress } });
};

const createCampaign = async (c: Context<TAppBindings>) => {
  const result = await campaignService.create(
    c.get("validatedBody"),
    c.get("user").email,
  );

  return sendResponse(c, httpStatus.CREATED, { data: result });
};

const updateCampaign = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await campaignService.update(
    id,
    c.get("validatedBody"),
    c.get("user").email,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const deleteCampaign = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await campaignService.remove(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const previewCampaign = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await campaignService.preview(id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const testCampaign = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await campaignService.testSend(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const startCampaign = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await campaignService.start(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

/**
 * Draining the rest by hand. The cron does this on its own; this keeps a send
 * moving when the cron is not configured or has just missed a tick.
 */
const continueCampaign = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  await campaignService.getById(id);
  const result = await campaignService.processBatch(id);

  return sendResponse(c, httpStatus.OK, {
    data: { ...result, progress: await campaignService.progress(id) },
  });
};

const campaignProgress = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await campaignService.progress(id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

export const newsletterController = {
  subscribe,
  readUnsubscribeLink,
  unsubscribe,
  resendEvents,
  cron,
  getMembership,
  setMembership,
};

export const newsletterAdminController = {
  getAllSubscribers,
  getSubscriber,
  createSubscriber,
  unsubscribeSubscriber,
  exportSubscribers,
  listCampaigns,
  campaignSuggestion,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  previewCampaign,
  testCampaign,
  startCampaign,
  continueCampaign,
  campaignProgress,
};
