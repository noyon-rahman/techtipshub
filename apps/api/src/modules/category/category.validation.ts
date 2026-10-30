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

const createRequest = z
  .object({
    name: z
      .string({ error: "Name must be a string" })
      .trim()
      .min(1, "Name is required")
      .max(60, "Name must be at most 60 characters"),
    description: z
      .string({ error: "Description must be a string" })
      .trim()
      .max(200, "Description must be at most 200 characters")
      .optional(),
  })
  .strict();

// A decline reason is optional: an admin may just say no. A reason sent with an
// approval is dropped by the service rather than rejected, so a panel that keeps
// its last answer in the body still works.
const decideRequest = z
  .object({
    status: z.enum(["approved", "declined"], {
      error: "Status must be approved or declined",
    }),
    declineReason: z
      .string({ error: "Reason must be a string" })
      .trim()
      .max(200, "Reason must be at most 200 characters")
      .optional(),
  })
  .strict();

// Query strings arrive as strings, so page and limit are converted here and
// bounded; the service still treats them as opt-in paging.
const requestList = z
  .object({
    status: z
      .enum(["pending", "approved", "declined"], {
        error: "Status must be pending, approved or declined",
      })
      .optional(),
    page: z.coerce.number().int().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    searchTerm: z.string().max(200).optional(),
  })
  .strict();

export const categoryValidationSchema = {
  create,
  update,
  deleteCategory,
  createRequest,
  decideRequest,
  requestList,
};
