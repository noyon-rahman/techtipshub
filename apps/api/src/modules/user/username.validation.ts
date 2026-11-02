import { z } from "zod";
import {
  USERNAME_MAX_LENGTH,
  normaliseUsername,
  usernameProblem,
} from "@techtipshub/shared";

/**
 * A handle, as every caller of the username rules sends it.
 *
 * The value is normalised first, so "Ada Lovelace" arriving from a form becomes
 * `ada_lovelace` rather than a refusal, and then checked against the one rule
 * in `@techtipshub/shared`, which is also what the availability answer and the
 * onboarding suggestion use. The API's own length and character rules used to
 * live here as a second copy; this is the same rule, not a looser one.
 */
export const usernameField = z
  .string({ error: "Username must be a string" })
  .transform((value) => normaliseUsername(value))
  .superRefine((value, ctx) => {
    const problem = usernameProblem(value);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  });

/** What the onboarding step sends: the handle the member confirmed. */
const completeUsernameOnboarding = z
  .object({ username: usernameField })
  .strict();

/**
 * The availability check takes the raw typing as well as a handle, because a
 * half-typed value is what a person produces while the answer is still useful:
 * "ada l" has to be able to say "at least 3 characters" rather than 400.
 */
const checkUsernameAvailability = z
  .object({
    username: z
      .string({ error: "Username must be a string" })
      .max(USERNAME_MAX_LENGTH * 2, { error: "Username is too long" }),
  })
  .strict();

export const usernameValidationSchema = {
  completeUsernameOnboarding,
  checkUsernameAvailability,
};
