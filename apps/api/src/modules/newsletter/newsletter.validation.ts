import { z } from "zod";

const email = z
  .string({ error: "Email is required" })
  .trim()
  .email("Please enter a valid email address")
  .max(254, "Email is too long");

const name = z
  .string({ error: "First name is required" })
  .trim()
  .min(1, "First name is required")
  .max(60, "First name is too long");

/** The public form on the site: a name, an address, and nothing else. */
const subscribe = z.object({ name, email }).strict();

/**
 * A token is 32 characters of base64url. It is checked again by signature, so
 * this only rejects obvious junk before the comparison runs.
 */
const unsubscribeQuery = z
  .object({
    email,
    token: z
      .string({ error: "This unsubscribe link is incomplete." })
      .trim()
      .min(1, "This unsubscribe link is incomplete."),
  })
  .strict();

/** The profile switch. `subscribed` is the state the switch is being moved to. */
const membership = z
  .object({
    subscribed: z.boolean({ error: "Choose whether to receive the newsletter" }),
  })
  .strict();

/** Admin add: the same shape as the public form, plus the greeting mail. */
const createSubscriber = z
  .object({
    name,
    email,
    sendWelcome: z.boolean().default(false),
  })
  .strict();

/** Removing someone from the admin list is the same act as their link. */
const unsubscribeBody = z
  .object({
    email,
  })
  .strict();

const campaignContent = {
  subject: z
    .string({ error: "A subject is required" })
    .trim()
    .min(3, "Subject must be at least 3 characters")
    .max(150, "Subject is too long"),
  preview: z
    .string()
    .trim()
    .max(140, "The preview line is too long")
    .default(""),
  heading: z
    .string({ error: "A heading is required" })
    .trim()
    .min(3, "Heading must be at least 3 characters")
    .max(120, "Heading is too long"),
  intro: z
    .string()
    .trim()
    .max(2000, "The intro is too long")
    .default(""),
  articleIds: z
    .array(z.string().trim().min(1), {
      error: "Pick the articles for this issue",
    })
    .max(40, "An issue can carry at most 40 articles"),
};

const createCampaign = z.object(campaignContent).strict();

const updateCampaign = z.object(campaignContent).strict();

/**
 * The cron's `Authorization` header. Checked here so the handler can read the
 * parsed value like every other route.
 */
const cronHeaders = z
  .object({
    authorization: z
      .string({ error: "Authorization is required" })
      .trim()
      .min(1, "Authorization is required"),
  })
  .passthrough();

/**
 * What Resend posts to the webhook, reduced to the parts we act on. The
 * signature is checked against the raw body before this ever runs; here the
 * body only has to be shaped like an event.
 */
const resendEvent = z
  .object({
    type: z.string().trim().min(1),
    data: z
      .object({
        to: z.union([z.string(), z.array(z.string())]).optional(),
        email: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const newsletterValidationSchema = {
  subscribe,
  unsubscribeQuery,
  unsubscribeBody,
  membership,
  createSubscriber,
  createCampaign,
  updateCampaign,
  cronHeaders,
  resendEvent,
};
