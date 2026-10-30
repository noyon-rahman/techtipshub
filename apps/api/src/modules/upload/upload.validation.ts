import { z } from "zod";

const signature = z
  .object({
    // Which folder the browser's direct upload is signed for.
    target: z.enum(["coverImage", "profilePicture", "image"], {
      error: "Target must be coverImage, profilePicture or image",
    }),
  })
  .strict();

/**
 * The id of an asset to delete.
 *
 * The client sends this back, so it is shaped tightly: a folder path with no
 * traversal and no leading slash. Whether the folder is one of ours is decided
 * in the service, which owns that list.
 */
const deleteAsset = z
  .object({
    publicId: z
      .string({ error: "Public Id must be a string" })
      .trim()
      .min(1, "Public Id is required")
      .max(200, "Public Id is too long")
      .refine((value) => !value.includes(".."), {
        message: "Public Id is not valid",
      })
      .refine((value) => !value.startsWith("/"), {
        message: "Public Id is not valid",
      }),
  })
  .strict();

export const uploadValidationSchema = { signature, deleteAsset };
