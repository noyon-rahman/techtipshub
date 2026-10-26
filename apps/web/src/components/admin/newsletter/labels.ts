import type {
  TCampaignStatus,
  TSubscriberSource,
  TSubscriberStatus,
} from "@/services/admin/newsletter";

/**
 * The words the newsletter screen uses for the API's states.
 *
 * A subscriber's status is what happened to the address, not a workflow step:
 * "Bounced" and "Reported spam" are both a refusal by the receiving server, so
 * they read as one family rather than as two admin states.
 */
export const SUBSCRIBER_LABEL: Record<TSubscriberStatus, string> = {
  active: "Active",
  unsubscribed: "Unsubscribed",
  bounced: "Bounced",
  complained: "Reported spam",
};

export const SOURCE_LABEL: Record<TSubscriberSource, string> = {
  site: "Signup form",
  profile: "Profile",
  admin: "Added by admin",
};

export const CAMPAIGN_LABEL: Record<TCampaignStatus, string> = {
  draft: "Draft",
  sending: "Sending",
  sent: "Sent",
};

/** Why an address cannot be mailed, in a sentence, for the row's detail. */
export const SUPPRESS_REASON: Record<"bounced" | "complained", string> = {
  bounced: "The receiving server refused mail to this address. It stays off every list for good.",
  complained:
    "The reader marked an issue as spam. Mail to this address is no longer sent.",
};

export const canRemove = (status: TSubscriberStatus) => status === "active";

/** Issues cannot be edited or deleted once the first batch is out. */
export const isEditable = (status: TCampaignStatus) => status === "draft";
