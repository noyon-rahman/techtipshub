import { model, Schema, Types } from "mongoose";

export type TNewsletterCampaignStatus = "draft" | "sending" | "sent";

export const NEWSLETTER_CAMPAIGN_STATUSES: TNewsletterCampaignStatus[] = [
  "draft",
  "sending",
  "sent",
];

/** One article in a campaign, fixed at the time it was picked. */
export interface INewsletterCampaignArticle {
  blog: Types.ObjectId;
  title: string;
  href: string;
  excerpt: string;
  coverImage: string;
  category: string;
}

export interface INewsletterRecipient {
  subscriber: Types.ObjectId;
  email: string;
  name: string;
  status: "pending" | "sending" | "sent" | "failed";
  attempts: number;
  lastError?: string | null;
  /** When the current tick took this slot; used to release a dead one. */
  claimedAt?: Date | null;
  sentAt?: Date | null;
}

export interface INewsletterCampaign {
  subject: string;
  /** The read-more line under the subject, kept under 140 characters. */
  preview: string;
  /** The heading at the top of the mail. */
  heading: string;
  /** The editor's own paragraph, plain text. */
  intro: string;
  articles: INewsletterCampaignArticle[];
  status: TNewsletterCampaignStatus;
  /** Set once the send starts, so a draft can be edited freely before it. */
  startedAt?: Date | null;
  finishedAt?: Date | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  recipients: INewsletterRecipient[];
  createdBy?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const articleSchema = new Schema<INewsletterCampaignArticle>(
  {
    blog: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    title: { type: String, required: true },
    href: { type: String, required: true },
    excerpt: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    category: { type: String, default: "" },
  },
  { _id: false },
);

const recipientSchema = new Schema<INewsletterRecipient>(
  {
    subscriber: {
      type: Schema.Types.ObjectId,
      ref: "NewsletterSubscriber",
      required: true,
    },
    email: { type: String, required: true },
    name: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    lastError: { type: String, default: null },
    claimedAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
  },
  { _id: false },
);

const campaignSchema = new Schema<INewsletterCampaign>(
  {
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    preview: { type: String, default: "", maxlength: 140 },
    heading: { type: String, required: true, trim: true, maxlength: 120 },
    intro: { type: String, default: "", maxlength: 2000 },
    articles: { type: [articleSchema], default: [] },
    status: {
      type: String,
      enum: {
        values: NEWSLETTER_CAMPAIGN_STATUSES,
        message: "{VALUE} is not a valid campaign status",
      },
      default: "draft",
    },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    recipientCount: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    recipients: { type: [recipientSchema], default: [] },
    createdBy: { type: String, default: null },
  },
  { timestamps: true },
);

/**
 * How the "Continue" press finds work: a sending campaign with recipients
 * left. The partial index keeps a draft or a finished one out of the scan.
 */
campaignSchema.index(
  { status: 1, createdAt: 1 },
  { partialFilterExpression: { status: "sending" } },
);

const NewsletterCampaign = model<INewsletterCampaign>(
  "NewsletterCampaign",
  campaignSchema,
  "newsletter_campaigns",
);

export default NewsletterCampaign;
