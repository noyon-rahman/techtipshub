import { z } from "zod";

/**
 * The newsletter signup form: a first name and an address.
 *
 * Trimmed before it is judged, so a pasted address with a trailing space is not
 * "not an email". The consent line under the form is not a checkbox, so there
 * is nothing else to validate.
 */
export const newsletterSignupSchema = z.object({
  name: z
    .string({ error: "First name is required" })
    .trim()
    .min(1, "First name is required")
    .max(60, "First name is too long"),
  email: z
    .string({ error: "Email is required" })
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email address")
    .max(254, "Email is too long"),
});

export type TNewsletterSignup = z.infer<typeof newsletterSignupSchema>;
