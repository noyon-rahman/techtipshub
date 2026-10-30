import { randomBytes } from "crypto";
import httpStatus from "http-status";
import { cloudinaryUpload } from "../../config/cloudinary.config";
import config from "../../config";
import {
  MAX_UPLOAD_BYTES,
  uploadToCloudinary,
  type TUploadedFile,
} from "../../config/upload.config";
import { AppError } from "../../errors";

export type TUploadTarget = "coverImage" | "profilePicture" | "image";

/** What the browser needs to POST a file straight to Cloudinary. */
export interface IUploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId: string;
  signature: string;
  uploadUrl: string;
  allowedFormats: string[];
  maxFileSize: number;
}

/** A stored cover: what the composer keeps and hands back to delete. */
export interface IUploadedCover {
  url: string;
  publicId: string;
}

const FOLDERS: Record<TUploadTarget, string> = {
  coverImage: "techtipshub/covers",
  profilePicture: "techtipshub/avatars",
  image: "techtipshub/images",
};

const ALLOWED_FORMATS = ["jpg", "jpeg", "png", "webp", "avif"];

/**
 * Sign a direct upload from the browser.
 *
 * Only `folder`, `public_id` and `timestamp` are signed because those are the
 * only parameters the browser must send back; the secret never leaves here.
 * The id is ours, not the client's, so one member cannot overwrite another's
 * asset and a crafted name cannot step outside the folder.
 */
const createSignature = (target: TUploadTarget): IUploadSignature => {
  const folder = FOLDERS[target];
  const publicId = randomBytes(16).toString("hex");
  const timestamp = Math.floor(Date.now() / 1000);

  const signature = cloudinaryUpload.utils.api_sign_request(
    { folder, public_id: publicId, timestamp },
    config.CLOUDINARY_API_SECRET,
  );

  return {
    cloudName: config.CLOUDINARY_CLOUD_NAME,
    apiKey: config.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    publicId,
    signature,
    uploadUrl: `https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/image/upload`,
    allowedFormats: ALLOWED_FORMATS,
    maxFileSize: MAX_UPLOAD_BYTES,
  };
};

/**
 * Store one cover through the API.
 *
 * The id is generated here and carries the folder, so two members uploading
 * `cover.jpg` land on different assets; the old per-name id did not. The size
 * is checked before Cloudinary, where a failure costs a whole encoded body.
 */
const uploadCover = async (file: File): Promise<IUploadedCover> => {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new AppError(
      httpStatus.REQUEST_ENTITY_TOO_LARGE,
      "That file is too large. Use an image under 4 MB.",
    );
  }

  const name = `${FOLDERS.coverImage}/${randomBytes(16).toString("hex")}`;

  let uploaded: TUploadedFile;

  try {
    uploaded = await uploadToCloudinary(file, { fieldname: "image", name });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    // eslint-disable-next-line no-console
    console.error("Cloudinary cover upload failed:", message);
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "The image could not be uploaded. Try again.",
    );
  }

  return { url: uploaded.path, publicId: uploaded.publicId };
};

/** The folders this site's assets live in. Nothing else may be deleted. */
const OWNED_FOLDERS = Object.values(FOLDERS).map((folder) => `${folder}/`);

const ownsAsset = (publicId: string) =>
  OWNED_FOLDERS.some((folder) => publicId.startsWith(folder));

/**
 * Delete one asset from Cloudinary.
 *
 * "not found" counts as success: the composer deletes on replace and again on
 * discard, and a second delete of the same id must not fail the form.
 */
const deleteAsset = async (publicId: string): Promise<void> => {
  if (!ownsAsset(publicId)) {
    throw new AppError(httpStatus.FORBIDDEN, "That asset does not belong here");
  }

  let result: { result?: string };

  try {
    result = (await cloudinaryUpload.uploader.destroy(publicId, {
      invalidate: true,
    })) as { result?: string };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delete failed.";
    // eslint-disable-next-line no-console
    console.error(`Cloudinary delete failed for ${publicId}:`, message);
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "The image could not be deleted. Try again.",
    );
  }

  if (result.result !== "ok" && result.result !== "not found") {
    // Anything else is Cloudinary refusing the key or the id, not a missing
    // file, so it is reported rather than answered as done.
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "The image could not be deleted. Try again.",
    );
  }
};

export const uploadService = { createSignature, uploadCover, deleteAsset };
