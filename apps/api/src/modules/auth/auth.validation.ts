import { z } from "zod";
import { usernameField } from "../user/username.validation";
import { UserGender } from "../user/user.constant";

/**
 * What a password has to be, everywhere one is chosen.
 *
 * Signup, change and reset all read this, so a rule can't hold on one route
 * and not another - the old code required six characters to *change* a
 * password but accepted one character at signup. Length is the property that
 * actually resists guessing, so it is the one enforced; the upper bound stops a
 * pathological input from being hashed, since bcrypt silently ignores anything
 * past 72 bytes.
 */
const password = (label = "Password") =>
  z
    .string({ error: `${label} must be a string` })
    .min(8, `${label} must be at least 8 characters`)
    .max(72, `${label} must be 72 characters or fewer`);

const register = z
  .object({
    fullName: z.string({ error: "Full Name must be string" }),
    username: usernameField,
    email: z.string({ error: "Email must be string" }),
    password: password(),
    gender: z.enum([...UserGender] as [string, ...string[]], {
      error: "Gender must be string",
    }),
    dateOfBirth: z
      .string({ error: "Date of Birth must be string" })
      .date("Invalid Date, Expected format: YYYY-MM-DD"),
    profilePicture: z
      .string({ error: "Profile Picture must be string" })
      .optional(),
  })
  .strict();

const login = z
  .object({
    email: z.string({ error: "Email must be string" }),
    // Sign-in only checks that a password was sent. The rules apply where one
    // is chosen, and an account created before them still has to get in.
    password: z.string({ error: "Password must be string" }),
  })
  .strict();

const changePassword = z
  .object({
    oldPassword: z.string({ error: "Old password must be a string" }),
    newPassword: password("New password"),
  })
  .strict();

const forgetPassword = z
  .object({
    email: z.string({ error: "Email must be a string" }),
  })
  .strict();

const resetPassword = z
  .object({
    newPassword: password("New password"),
  })
  .strict();

/** The code a Google callback hands to the site. */
const claimSession = z
  .object({
    handoff: z.string({ error: "Handoff code must be a string" }).min(1),
  })
  .strict();

export const authValidationSchema = {
  register,
  login,
  changePassword,
  forgetPassword,
  resetPassword,
  claimSession,
};
