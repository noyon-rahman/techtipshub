import httpStatus from "http-status";
import mongoose from "mongoose";
import config, { isEmailConfigured } from "../../config";
import { MAIL_REPLY_TO } from "../../config/mail";
import { newsletterCampaignMessage, type TCampaignContent } from "../../emails";
import AppError from "../../errors/AppError";
import sendEmail from "../../utils/sendEmail";
import { adminLogService } from "../admin/admin-log.service";
import Blog from "../blog/blog.model";
import NewsletterCampaign from "./newsletter-campaign.model";
import NewsletterSubscriber from "./newsletter.model";
import { unsubscribeUrl } from "./newsletter.tokens";

/**
 * How many mails one press sends.
 *
 * Ten over Resend's default two-requests-per-second limit leaves room for
 * retries, and one press fits the time a serverless function is given. The
 * queue is resumable, so a long list takes more presses rather than a longer
 * request.
 */
export const BATCH_SIZE = 10;

/** Give up on one address after this many failures, and say so in the record. */
const MAX_ATTEMPTS = 3;

/** What the composer writes and the templates render. */
export type TCampaignInput = {
  subject: string;
  preview: string;
  heading: string;
  intro: string;
  /**
   * Article ids in the order they should appear. The titles, links and
   * excerpts are copied from the article now, so editing or removing one
   * later cannot change an issue that was already sent.
   */
  articleIds: string[];
};

const toHref = (blog: {
  _id: mongoose.Types.ObjectId | string;
  slug: string;
  title: string;
}) => {
  const site = config.CLIENT_BASE_URL.replace(/\/$/, "");
  // Older articles may predate a slug; the id is a working address for them.
  return blog.slug
    ? `${site}/blogs/${encodeURIComponent(blog.slug)}`
    : `${site}/blogs/${String(blog._id)}`;
};

const excerptOf = (content: string) => {
  const text = content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= 180) return text;

  // Cut at the last whole word, so the excerpt does not end mid-syllable.
  const cut = text.slice(0, 180);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 120 ? cut.slice(0, lastSpace) : cut).trimEnd()}\u2026`;
};

/** Resolve the picked ids into the frozen copy an issue keeps. */
const resolveArticles = async (ids: string[]) => {
  const unique = Array.from(new Set(ids));
  if (unique.length === 0) return [];

  const invalid = unique.filter((id) => !mongoose.Types.ObjectId.isValid(id));
  if (invalid.length > 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "One of the articles is not valid.",
    );
  }

  const blogs = await Blog.find({ _id: { $in: unique } })
    .populate({ path: "category", select: "name" })
    .select("title slug content coverImage category createdAt");

  const byId = new Map(blogs.map((blog) => [String(blog._id), blog]));

  const ordered = unique
    .map((id) => byId.get(id))
    .filter((blog): blog is NonNullable<typeof blog> => Boolean(blog));

  if (ordered.length !== unique.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "One of the articles no longer exists. Reload and pick again.",
    );
  }

  return ordered.map((blog) => {
    const category = blog.category as unknown as { name?: string } | null;

    return {
      blog: blog._id,
      title: blog.title,
      href: toHref(blog),
      excerpt: excerptOf(blog.content ?? ""),
      coverImage: blog.coverImage ?? "",
      category: category?.name ?? "",
    };
  });
};

const toContent = (campaign: {
  subject: string;
  preview: string;
  heading: string;
  intro: string;
  articles: {
    title: string;
    href: string;
    excerpt: string;
    coverImage: string;
    category: string;
  }[];
}): TCampaignContent => ({
  subject: campaign.subject,
  preview: campaign.preview,
  heading: campaign.heading,
  intro: campaign.intro,
  articles: campaign.articles.map((article) => ({
    title: article.title,
    href: article.href,
    excerpt: article.excerpt,
    coverImage: article.coverImage,
    category: article.category,
  })),
});

/**
 * Suggestions for a new issue: everything published since the last campaign
 * that actually started, newest first. Before the first send that is every
 * article, which is what makes the launch issue possible.
 */
const suggestion = async () => {
  const last = await NewsletterCampaign.findOne({
    status: { $in: ["sending", "sent"] },
  })
    .sort({ startedAt: -1 })
    .select("startedAt subject");

  const since = last?.startedAt ?? undefined;

  const blogs = await Blog.find(since ? { createdAt: { $gt: since } } : {})
    .populate({ path: "category", select: "name" })
    .sort({ createdAt: -1 })
    .limit(60)
    .select("title slug coverImage category createdAt");

  const lastTitle = last?.subject ?? null;

  return {
    /** The heading a monthly issue starts with, e.g. "October 2026". */
    heading: new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date()),
    since: since ?? null,
    lastSubject: lastTitle,
    articles: blogs.map((blog) => ({
      _id: String(blog._id),
      title: blog.title,
      slug: blog.slug,
      coverImage: blog.coverImage,
      category:
        (blog.category as unknown as { name?: string } | null)?.name ?? "",
      createdAt: blog.createdAt,
      href: blog.slug ? `/blogs/${blog.slug}` : `/blogs/${String(blog._id)}`,
    })),
  };
};

const getById = async (id: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid campaign id");
  }

  const campaign = await NewsletterCampaign.findById(id);
  if (!campaign) {
    throw new AppError(httpStatus.NOT_FOUND, "Campaign not found");
  }

  return campaign;
};

const list = async (query: Record<string, unknown>) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

  const [result, total] = await Promise.all([
    NewsletterCampaign.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "subject heading status startedAt finishedAt recipientCount sentCount failedCount createdAt",
      ),
    NewsletterCampaign.countDocuments({}),
  ]);

  return {
    result,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
};

/** Drafts are editable; once a send starts, the copy an issue sent is fixed. */
const assertDraft = (status: string) => {
  if (status !== "draft") {
    throw new AppError(
      httpStatus.CONFLICT,
      "This issue has already started sending, so it can no longer be edited.",
    );
  }
};

const create = async (input: TCampaignInput, adminEmail?: string) => {
  const articles = await resolveArticles(input.articleIds);

  const campaign = await NewsletterCampaign.create({
    subject: input.subject.trim(),
    preview: input.preview.trim(),
    heading: input.heading.trim(),
    intro: input.intro.trim(),
    articles,
    status: "draft",
    createdBy: adminEmail ?? null,
  });

  return campaign;
};

const update = async (
  id: string,
  input: TCampaignInput,
  adminEmail?: string,
) => {
  const campaign = await getById(id);
  assertDraft(campaign.status);

  campaign.subject = input.subject.trim();
  campaign.preview = input.preview.trim();
  campaign.heading = input.heading.trim();
  campaign.intro = input.intro.trim();
  campaign.articles = (await resolveArticles(input.articleIds)) as never;

  await campaign.save();

  await adminLogService.record({
    adminEmail,
    action: "newsletter.campaign.edit",
    targetType: "newsletter",
    targetId: String(campaign._id),
    summary: `Edited issue "${campaign.subject}"`,
  });

  return campaign;
};

const remove = async (id: string, adminEmail?: string) => {
  const campaign = await getById(id);
  assertDraft(campaign.status);

  await campaign.deleteOne();

  await adminLogService.record({
    adminEmail,
    action: "newsletter.campaign.delete",
    targetType: "newsletter",
    targetId: id,
    summary: `Deleted draft issue "${campaign.subject}"`,
  });

  return { deleted: true };
};

/**
 * The mail an admin sees before sending anything. The opt-out link is disabled
 * here: the preview is a sample address, and the campaign's real links are
 * signed per reader when it goes out.
 */
const preview = async (id: string) => {
  const campaign = await getById(id);
  const sample = unsubscribeUrl("preview@example.com");

  const mail = await newsletterCampaignMessage({
    content: toContent(campaign),
    name: "Alex",
    unsubscribeUrl: sample,
  });

  return { ...mail, html: mail.html.split(sample).join("#preview") };
};

/** Send one copy to the admin who is signed in, so they can check a real inbox. */
const testSend = async (id: string, adminEmail: string) => {
  if (!isEmailConfigured()) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Email is not configured on this server.",
    );
  }

  const campaign = await getById(id);
  const address = adminEmail.trim();

  const mail = await newsletterCampaignMessage({
    content: toContent(campaign),
    name: "",
    unsubscribeUrl: unsubscribeUrl(address),
  });

  await sendEmail({
    to: { address },
    sender: "newsletter",
    // Replies to a test land back in the admin's own mailbox, not the inbox
    // readers write to.
    replyTo: { address },
    category: "newsletter-test",
    throwOnError: true,
    // A test copy is not a subscription, so it carries no one-click opt-out.
    // Resend's own suppression list already covers a reader who reports it.
    ...mail,
  });

  return { sentTo: address };
};

const recipientCountFor = async () => {
  const active = await NewsletterSubscriber.countDocuments({
    status: "active",
  });
  if (active === 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      "There is nobody to send to yet. Add a subscriber first.",
    );
  }
  return active;
};

/**
 * Start sending. The active list is frozen into the campaign now, so a signup
 * or an unsubscribe that arrives mid-send does not change who this issue
 * reaches. The first batch goes out on this request; the rest is drained by
 * the cron, or by "Continue" when the cron is not set up.
 */
const start = async (
  id: string,
  adminEmail?: string,
  subscriberIds?: string[],
) => {
  if (!isEmailConfigured()) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Email is not configured on this server.",
    );
  }

  const campaign = await getById(id);
  if (campaign.status !== "draft") {
    throw new AppError(
      httpStatus.CONFLICT,
      "This issue has already been started.",
    );
  }

  const uniqueIds = subscriberIds?.length
    ? Array.from(new Set(subscriberIds))
    : undefined;

  if (uniqueIds) {
    const invalid = uniqueIds.find(
      (subscriberId) => !mongoose.Types.ObjectId.isValid(subscriberId),
    );
    if (invalid) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "One of the selected subscribers has an invalid id.",
      );
    }
  } else {
    await recipientCountFor();
  }

  const recipientFilter = uniqueIds
    ? { _id: { $in: uniqueIds }, status: "active" as const }
    : { status: "active" as const };

  const recipients = await NewsletterSubscriber.find(recipientFilter)
    .select("_id email name")
    .sort({ createdAt: 1 })
    .lean();

  if (recipients.length === 0) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      uniqueIds
        ? "None of the selected subscribers are active."
        : "There is nobody active on the list yet.",
    );
  }

  campaign.recipients = recipients.map((subscriber) => ({
    subscriber: subscriber._id,
    email: subscriber.email,
    name: subscriber.name,
    status: "pending" as const,
    attempts: 0,
    lastError: null,
    sentAt: null,
  }));
  campaign.recipientCount = recipients.length;
  campaign.sentCount = 0;
  campaign.failedCount = 0;
  campaign.status = "sending";
  campaign.startedAt = new Date();
  await campaign.save();

  await adminLogService.record({
    adminEmail,
    action: "newsletter.campaign.send",
    targetType: "newsletter",
    targetId: String(campaign._id),
    summary: uniqueIds
      ? `Started issue "${campaign.subject}" to ${recipients.length} selected ${recipients.length === 1 ? "subscriber" : "subscribers"}`
      : `Started issue "${campaign.subject}" to ${recipients.length} subscribers`,
  });

  await processBatch(String(campaign._id));

  return getById(id);
};

/**
 * One tick of the queue.
 *
 * Each recipient is claimed on its own, with a conditional update that moves a
 * pending slot to `sending` and only matches if it is still pending. Two ticks
 * running at once therefore cannot take the same slot, and the campaign copy
 * never has to guess which address belongs to this iteration.
 *
 * A slot left in `sending` by a crashed tick is released by
 * `recoverAbandoned` before a new one is claimed.
 */
const LEASE_MS = 5 * 60 * 1000;

const staleBefore = () => new Date(Date.now() - LEASE_MS);

const claimSlot = async (campaignId?: string) => {
  const filter: Record<string, unknown> = {
    status: "sending",
    recipients: {
      $elemMatch: { status: "pending", attempts: { $lt: MAX_ATTEMPTS } },
    },
  };

  if (campaignId) filter._id = campaignId;

  const campaign = await NewsletterCampaign.findOne(filter);
  if (!campaign) return undefined;

  const slot = campaign.recipients.find(
    (recipient) =>
      recipient.status === "pending" && recipient.attempts < MAX_ATTEMPTS,
  );
  if (!slot) return undefined;

  const claimed = await NewsletterCampaign.findOneAndUpdate(
    {
      _id: campaign._id,
      recipients: {
        $elemMatch: {
          subscriber: slot.subscriber,
          status: "pending",
          attempts: { $lt: MAX_ATTEMPTS },
        },
      },
    },
    {
      $set: {
        "recipients.$[slot].status": "sending",
        "recipients.$[slot].claimedAt": new Date(),
      },
      $inc: { "recipients.$[slot].attempts": 1 },
    },
    {
      new: true,
      arrayFilters: [
        {
          "slot.subscriber": slot.subscriber,
          "slot.status": "pending",
          "slot.attempts": { $lt: MAX_ATTEMPTS },
        },
      ],
    },
  );

  if (!claimed) return undefined;

  const taken = claimed.recipients.find(
    (recipient) =>
      String(recipient.subscriber) === String(slot.subscriber) &&
      recipient.status === "sending",
  );

  return taken ? { campaign: claimed, slot: taken } : undefined;
};

/** Return slots a dead tick left behind, so the queue does not stall. */
const recoverAbandoned = async () => {
  const stale = await NewsletterCampaign.updateMany(
    { status: "sending" },
    {
      $set: {
        "recipients.$[slot].status": "pending",
      },
    },
    {
      arrayFilters: [
        { "slot.status": "sending", "slot.claimedAt": { $lt: staleBefore() } },
      ],
    },
  );

  return stale.modifiedCount;
};

/**
 * Send one batch and report what is left. The admin's "Continue" calls this:
 * there is no scheduled job, so the queue moves when someone asks it to.
 */
const processBatch = async (campaignId?: string) => {
  await recoverAbandoned();

  let sent = 0;
  let failed = 0;
  const touched = new Set<string>();

  for (let i = 0; i < BATCH_SIZE; i += 1) {
    const claim = await claimSlot(campaignId);
    if (!claim) break;

    const { campaign, slot } = claim;
    touched.add(String(campaign._id));

    try {
      const mail = await newsletterCampaignMessage({
        content: toContent(campaign),
        name: slot.name,
        unsubscribeUrl: unsubscribeUrl(slot.email),
      });

      await sendEmail({
        to: { name: slot.name, address: slot.email },
        sender: "newsletter",
        replyTo: { name: MAIL_REPLY_TO, address: MAIL_REPLY_TO },
        category: "newsletter-campaign",
        // Stable per issue and address: a retry after a lost response is not a
        // second delivery.
        idempotencyKey: `campaign-${String(campaign._id)}-${slot.email}`,
        throwOnError: true,
        unsubscribeUrl: unsubscribeUrl(slot.email),
        ...mail,
      });

      await NewsletterCampaign.updateOne(
        { _id: campaign._id, "recipients.subscriber": slot.subscriber },
        {
          $set: {
            "recipients.$.status": "sent",
            "recipients.$.sentAt": new Date(),
            "recipients.$.claimedAt": null,
            "recipients.$.lastError": null,
          },
          $inc: { sentCount: 1 },
        },
      );

      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const giveUp = slot.attempts >= MAX_ATTEMPTS;

      await NewsletterCampaign.updateOne(
        { _id: campaign._id, "recipients.subscriber": slot.subscriber },
        {
          $set: {
            "recipients.$.status": giveUp ? "failed" : "pending",
            "recipients.$.claimedAt": null,
            "recipients.$.lastError": message.slice(0, 300),
          },
          ...(giveUp ? { $inc: { failedCount: 1 } } : {}),
        },
      );

      failed += 1;
    }
  }

  // An issue is finished when no slot can still be attempted.
  const remaining = await NewsletterCampaign.find({
    status: "sending",
    ...(campaignId ? { _id: campaignId } : {}),
  }).select("_id recipients");

  const finished: string[] = [];

  for (const campaign of remaining) {
    const hasWork = campaign.recipients.some(
      (recipient) =>
        (recipient.status === "pending" || recipient.status === "sending") &&
        recipient.attempts < MAX_ATTEMPTS,
    );

    if (hasWork) continue;

    const counts = { sent: 0, failed: 0 };
    for (const recipient of campaign.recipients) {
      if (recipient.status === "sent") counts.sent += 1;
      else counts.failed += 1;
    }

    campaign.status = "sent";
    campaign.finishedAt = new Date();
    campaign.sentCount = counts.sent;
    campaign.failedCount = counts.failed;
    // The addresses have been delivered to; the list of them is no longer
    // needed, and dropping it keeps a finished issue small.
    campaign.recipients = [];
    await campaign.save();

    finished.push(String(campaign._id));
  }

  return {
    sent,
    failed,
    processed: sent + failed,
    campaignsTouched: touched.size,
    finished,
  };
};

/** What the admin screen polls while an issue is going out. */
const progress = async (id: string) => {
  const campaign = await getById(id);

  const counts = { pending: 0, sending: 0, sent: 0, failed: 0 };
  for (const recipient of campaign.recipients) counts[recipient.status] += 1;

  return {
    _id: String(campaign._id),
    status: campaign.status,
    recipientCount: campaign.recipientCount,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    startedAt: campaign.startedAt ?? null,
    finishedAt: campaign.finishedAt ?? null,
    remaining: counts.pending + counts.sending,
  };
};

export const campaignService = {
  BATCH_SIZE,
  suggestion,
  list,
  getById,
  create,
  update,
  remove,
  preview,
  testSend,
  start,
  processBatch,
  progress,
  recipientCountFor,
};
