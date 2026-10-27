import type { Types } from "mongoose";

export type TNewsletterSubscriberStatus =
  "active" | "unsubscribed" | "bounced" | "complained";

export const NEWSLETTER_SUBSCRIBER_STATUSES: TNewsletterSubscriberStatus[] = [
  "active",
  "unsubscribed",
  "bounced",
  "complained",
];

/**
 * Where a subscriber came from. The value is shown in the admin list and in
 * the CSV export, so it is a real word rather than a code.
 */
export type TNewsletterSource = "site" | "profile" | "admin";

export const NEWSLETTER_SOURCES: TNewsletterSource[] = [
  "site",
  "profile",
  "admin",
];

export interface INewsletterSubscriber {
  name: string;
  email: string;
  /** Lowercased and trimmed, so one address cannot become two rows. */
  emailKey: string;
  status: TNewsletterSubscriberStatus;
  source: TNewsletterSource;
  /** The member whose profile toggled this on, when one did. */
  user?: Types.ObjectId | null;
  consentAt: Date;
  unsubscribedAt?: Date | null;
  suppressedAt?: Date | null;
  /** What Resend reported: `bounced` or `complained`. */
  suppressReason?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
