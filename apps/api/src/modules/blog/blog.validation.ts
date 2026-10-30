import mongoose from "mongoose";
import { z } from "zod";
import config from "../../config";
import { BlogContentType } from "./blog.constant";

/**
 * A cover is set by the client now (a signed direct upload), so only a URL on
 * our own Cloudinary account is accepted.
 */
const coverImageUrl = z
  .string({ error: "Cover Image must be a string" })
  .refine(
    (value) =>
      value.startsWith(
        `https://res.cloudinary.com/${config.CLOUDINARY_CLOUD_NAME}/`,
      ),
    { message: "Cover Image must be an image uploaded from this site" },
  );

const create = z
  .object({
    title: z.string({ error: "Title must be a string" }),
    contentType: z.enum([...BlogContentType] as [string, ...string[]], {
      error: "Content Type must be a string",
    }),
    content: z.string({ error: "Content must be a string" }),
    coverImage: coverImageUrl,
    // A live category's id. A member who needs one makes it from the composer
    // first, so there is nothing else this field can hold.
    category: z
      .string({ error: "Category Id must be a string" })
      .trim()
      .min(1, "Choose a category"),
    images: z
      .array(z.string({ error: "Image must be a string" }), {
        error: "Images must be an array string",
      })
      .min(1, "Images must be at least one image url")
      .optional(),
    tags: z.array(z.string({ error: "Tag must be a string" }), {
      error: "Tags must be an array of string",
    }),
  })
  .strict();

const update = z
  .object({
    title: z.string({ error: "Title must be a string" }).optional(),
    contentType: z
      .enum([...BlogContentType] as [string, ...string[]], {
        error: "Content Type must be a string",
      })
      .optional(),
    content: z.string({ error: "Content must be a string" }).optional(),
    coverImage: coverImageUrl.optional(),
    // Same as `create`: a live category's id.
    category: z
      .string({ error: "Category Id must be a string" })
      .trim()
      .min(1, "Choose a category")
      .optional(),
    tags: z
      .array(z.string({ error: "Tag must be a string" }), {
        error: "Tags must be an array of string",
      })
      .optional(),
  })
  .strict();

const updateByAdmin = z
  .object({
    // The author is set at creation and only an admin can choose it, there.
    userId: z
      .string({ error: "User Id must be a string" })
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid User Id",
      })
      .optional(),
    // The address is normalised by the service, so the panel may send what the
    // admin typed; only length is checked here.
    slug: z
      .string({ error: "Slug must be a string" })
      .trim()
      .min(3, "The address must be at least 3 characters")
      .max(160, "The address must be at most 160 characters")
      .optional(),
    title: z.string({ error: "Title must be a string" }).optional(),
    contentType: z
      .enum([...BlogContentType] as [string, ...string[]], {
        error: "Content Type must be a string",
      })
      .optional(),
    content: z.string({ error: "Content must be a string" }).optional(),
    coverImage: coverImageUrl.optional(),
    category: z
      .string({ error: "Category Id must be a string" })
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid Category Id",
      })
      .optional(),
    tags: z
      .array(z.string({ error: "Tag must be a string" }), {
        error: "Tags must be an array of string",
      })
      .optional(),
  })
  .strict();

/**
 * The admin composer's body: the same article fields, plus whose byline it is
 * and whether it goes live now. `userId` is required here because an admin
 * writing on their own behalf should use the member composer.
 */
const createByAdmin = create
  .extend({
    userId: z
      .string({ error: "Choose the member this article is for" })
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid User Id",
      }),
    publish: z.boolean({ error: "Publish must be true or false" }),
  })
  .strict();

export const blogValidationSchema = {
  create,
  createByAdmin,
  update,
  updateByAdmin,
};
