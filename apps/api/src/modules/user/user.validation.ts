import { z } from "zod";
import { SocialPlatform, UserGender } from "./user.constant";

// One shape for both editors: a member's own form and the admin panel's. Role,
// status and email are left out because each has its own endpoint.
const profileFields = {
  fullName: z.string({ error: "Full Name must be a string" }).optional(),
  username: z
    .string({ error: "Username must be a string" })
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be at most 30 characters")
    .regex(/^[a-zA-Z0-9_]+$/, {
      error: "Username can only use letters, numbers and underscores",
    })
    .optional(),
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

export const userValidationSchema = {
  updateProfile,
  updateProfileByAdmin,
  updateSocialLinks,
};
