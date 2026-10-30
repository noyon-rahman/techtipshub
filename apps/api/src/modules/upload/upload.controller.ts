import type { Context } from "hono";
import httpStatus from "http-status";
import type { TAppBindings } from "../../interface/bindings";
import { filesFrom } from "../../config/upload.config";
import { AppError } from "../../errors";
import sendResponse from "../../utils/sendResponse";
import { uploadService } from "./upload.service";
import type { TUploadTarget } from "./upload.service";

const sign = async (c: Context<TAppBindings>) => {
  const { target } = c.get("validatedBody") as { target: TUploadTarget };

  const result = uploadService.createSignature(target);

  return sendResponse(c, httpStatus.OK, { data: result });
};

/**
 * Take a cover the moment the writer picks it.
 *
 * Read from the raw form rather than `withUploads`, because that middleware
 * is shared with the article routes, whose ids still come from the file name.
 */
const uploadCover = async (c: Context<TAppBindings>) => {
  const parsed = await c.req.parseBody({ all: true }).catch(() => undefined);

  if (!parsed) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "The form could not be read. Send it as multipart form data.",
    );
  }

  const file = filesFrom(parsed.image)[0];

  if (!file) {
    throw new AppError(httpStatus.BAD_REQUEST, "Choose an image to upload");
  }

  const result = await uploadService.uploadCover(file);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const deleteAsset = async (c: Context<TAppBindings>) => {
  const { publicId } = c.get("validatedBody") as { publicId: string };

  await uploadService.deleteAsset(publicId);

  return sendResponse(c, httpStatus.OK, { data: { deleted: true } });
};

export const uploadController = { sign, uploadCover, deleteAsset };
