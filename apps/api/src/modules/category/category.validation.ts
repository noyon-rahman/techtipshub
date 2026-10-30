import { z } from "zod";

const create = z
  .object({
    name: z
      .string({ error: "Name must be a string" })
      .min(1, "Category name must be at least one character"),
    description: z
      .string({ error: "Description must be a string" })
      .min(1, "Description must be at least one character")
      .optional(),
  })
  .strict();

const update = z
  .object({
    name: z
      .string({ error: "Name must be a string" })
      .min(1, "Category name must be at least one character")
      .optional(),
    description: z
      .string({ error: "Description must be a string" })
      .min(1, "Description must be at least one character")
      .optional(),
  })
  .strict();

/**
 * Admin delete changes nothing the caller supplies, so the body is left alone;
 * the schema exists so the route reports invalid bodies like its siblings do.
 */
const deleteCategory = z.object({}).passthrough();

/**
 * A member naming a category from the composer. Tighter than the admin create:
 * the name lands in a public list and a public path, so it is bounded here
 * rather than left to whatever the field allowed.
 */
const createByAuthor = z
  .object({
    name: z
      .string({ error: "Name must be a string" })
      .trim()
      .min(2, "Use at least 2 characters")
      .max(40, "Use 40 characters or fewer"),
    description: z
      .string({ error: "Description must be a string" })
      .trim()
      .max(200, "Use 200 characters or fewer")
      .optional(),
  })
  .strict();

export const categoryValidationSchema = {
  create,
  createByAuthor,
  update,
  deleteCategory,
};
