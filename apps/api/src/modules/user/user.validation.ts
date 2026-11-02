import { z } from "zod";
import { SocialPlatform, UserGender } from "./user.constant";
import { usernameField } from "./username.validation";

// One shape for both editors: a member's own form and the admin panel's. Role,
// status and email are left out because each has its own endpoint.
const profileFields = {
  fullName: z.string({ error: "Full Name must be a string" }).optional(),
  username: usernameField.optional(),
  bio: z.string({ error: "Bio must be a string" }).optional(),
  designation: z.string({ error: "Designation must be a string" }).optional(),
  phone: z.string({ error: "Phone must be a string" }).optional(),
  location: z.string({ error: "Location must be a string" }).optional(),
  dateOfBirth: z.string({ error: "Date of birth must be a string" }).optional(),
  gender: z
    .enum([...UserGender] as [string, ...string[]], {
      error: "Gender must be string",
    })
    .optional(),
  profilePicture: z
    .string({ error: "Profile picture must be a string" })
    .optional(),
};

const updateProfile = z.object(profileFields).strict();

const updateProfileByAdmin = z.object(profileFields).strict();

const socialLinkSchema = z
  .object({
    platform: z.enum([...SocialPlatform] as [string, ...string[]], {
      error: "Social Platform must be string",
    }),
    url: z.string().url("Invalid URL"),
  })
  .optional();

const updateSocialLinks = z
  .object({
    socialLinks: z
      .array(socialLinkSchema)
      .min(1, "At least one social link is required")
      .max(6, "No more than 6 social links are allowed")
      .refine(
        (socialLinks) => {
          const platforms = socialLinks.map((link) => link?.platform);
          return new Set(platforms).size === platforms.length;
        },
        {
          message: "Social platforms must be unique",
        },
      )
      .optional(),
  })
  .strict();

/** A Mongo object id, as the strings the site sends. */
const objectId = z
  .string({ error: "Interest must be a category id" })
  .regex(/^[a-f0-9]{24}$/i, { error: "Interest must be a category id" });

/**
 * The interests step. An empty list is a real answer: it is how a reader says
 * "not these", and it is what skipping sends, so nothing here requires one.
 * The ids are checked against live categories by the service, which is the
 * only place that knows which ones exist.
 */
const updateInterests = z
  .object({
    interests: z
      .array(objectId)
      .max(20, { error: "Pick no more than 20 interests" })
      .refine((ids) => new Set(ids).size === ids.length, {
        error: "The same category was picked twice",
      }),
  })
  .strict();

export const userValidationSchema = {
  updateProfile,
  updateProfileByAdmin,
  updateSocialLinks,
  updateInterests,
};
