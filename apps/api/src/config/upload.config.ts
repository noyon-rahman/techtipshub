import { randomBytes } from "crypto";
import path from "path";
import { cloudinaryUpload } from "./cloudinary.config";

/**
 * Cloudinary upload for a multipart request.
 *
 * Multer used to do this. Its storage engine passed no public id, so Cloudinary
 * chose one itself: the base name as it arrived. That is kept here because the
 * stored URLs depend on it - a file called `cover.png` lives at
 * `…/upload/<version>/cover.png`, and articles reference exactly that.
 */

/** The subset of a Cloudinary upload answer the app keeps. */
export interface TUploadedFile {
  fieldname: string;
  /** The secure URL, which is what gets stored on the document. */
  path: string;
  originalname: string;
  mimetype: string;
  size: number;
}

/**
 * Upload one file.
 *
 * The resource type can be `auto` (anything, used for profile pictures) or
 * `image` (which is what Multer's engine used, and what the article and
 * comment routes rely on).
 *
 * The public id is the file's own base name, which is what Multer's engine
 * produced: Cloudinary takes the format from the uploaded bytes and appends
 * it, so `cover.png` lands at `…/upload/<version>/cover.png`. Passing the
 * extension through as well would produce `cover.png.png`. A file with no
 * name (a pasted image, an empty form field) gets a generated one instead.
 */
export const uploadToCloudinary = async (
  file: File,
  options: { fieldname: string; resourceType?: "auto" | "image" },
): Promise<TUploadedFile> => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base =
    path.parse(file.name ?? "").name ||
    `upload_${randomBytes(8).toString("hex")}`;

  const uploaded = await cloudinaryUpload.uploader.upload(
    `data:${file.type};base64,${buffer.toString("base64")}`,
    {
      resource_type: options.resourceType ?? "image",
      public_id: base,
    },
  );

  return {
    fieldname: options.fieldname,
    path: uploaded.secure_url,
    originalname: file.name,
    mimetype: file.type,
    size: buffer.byteLength,
  };
};

/**
 * Files sent under one field name.
 *
 * A single file and an empty field look the same on the wire, so both are
 * read here and the caller decides how many it expects. Anything that is not
 * a File (the `data` text part, a string) is ignored.
 */
export const filesFrom = (value: unknown): File[] => {
  const values = Array.isArray(value) ? value : [value];

  return values.filter((item): item is File => item instanceof File);
};
