import mongoose from "mongoose";
import { z } from "zod";
import { BlogContentType } from "./blog.constant";

const create = z
  .object({
    title: z.string({ error: "Title must be a string" }),
    contentType: z.enum([...BlogContentType] as [string, ...string[]], {
      error: "Content Type must be a string",
    }),
    content: z.string({ error: "Content must be a string" }),
    coverImage: z.string({ error: "Cover Image must be a string" }),
    category: z
      .string({ error: "Category Id must be a string" })
      .refine((val) => mongoose.Types.ObjectId.isValid(val), {
        message: "Invalid Category Id",
      }),
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
    coverImage: z
      .string({ error: "Cover Image must be a string" })
      .optional(),
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

const updateByAdmin = z
  .object({
    // The author is fixed at creation, so the panel may still send this.
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
    coverImage: z
      .string({ error: "Cover Image must be a string" })
      .optional(),
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

export const blogValidationSchema = {
  create,
  update,
  updateByAdmin,
};
