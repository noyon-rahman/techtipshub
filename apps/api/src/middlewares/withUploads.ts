import httpStatus from "http-status";
import type { Context, MiddlewareHandler } from "hono";
import { AppError } from "../errors";
import {
  filesFrom,
  uploadToCloudinary,
  type TUploadedFile,
} from "../config/upload.config";
import type { TAppBindings } from "../interface/bindings";

export interface IUploadOptions {
  /** The multipart field the files arrive under. */
  field: string;
  /** Object key the uploaded files are written to. */
  target: "coverImage" | "profilePicture" | "images";
  /** A single file, or a list. */
  multiple?: boolean;
  resourceType?: "auto" | "image";
}

/**
 * Read a multipart write the way the old Multer routes did.
 *
 * The browser sends the document as one JSON string in a `data` part, plus
 * however many files the route accepts. The JSON is parsed here, the files
 * are uploaded to Cloudinary, and the two are merged into one object that is
 * put on the context as the validated body. A handler therefore sees a plain
 * object, exactly as if the request had been JSON.
 *
 * Where the files land is the caller's choice, because each endpoint names
 * its image field differently: `coverImage`, `profilePicture`, `images`.
 */
export const withUploads = (
  options: IUploadOptions,
): MiddlewareHandler<TAppBindings> => {
  return async (c, next) => {
    const { body, files } = await readMultipart(c, options.field);

    if (files.length > 0) {
      const uploaded = await Promise.all(
        files.map((file) => uploadOne(file, options)),
      );
      const paths = uploaded.map((file) => file.path);

      if (options.target === "images") {
        // A comment can carry several pictures; the routes that allow more
        // than one always replace the list, which is what the old helpers did.
        body.images = options.multiple ? paths : paths[0];
      } else {
        body[options.target] = paths[0];
      }
    }

    c.set("validatedBody", body);
    c.set("uploadedBody", body);
    await next();
  };
};

const readMultipart = async (c: Context<TAppBindings>, field: string) => {
  const parsed = await c.req.parseBody({ all: true }).catch(() => undefined);

  if (!parsed) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "The form could not be read. Send it as multipart form data.",
    );
  }

  // The document is a JSON string in `data`. A request that sends only
  // fields (an edit with no new image) still carries it; a body sent as plain
  // JSON instead is read by the route's validator, not here.
  // `data` is not sent twice; `all` only turns a repeat into an array.
  const raw = Array.isArray(parsed.data) ? parsed.data[0] : parsed.data;
  let body: Record<string, unknown> = {};

  if (typeof raw === "string" && raw.trim()) {
    try {
      const decoded = JSON.parse(raw) as unknown;

      if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
        throw new Error("not an object");
      }

      body = decoded as Record<string, unknown>;
    } catch {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "The submitted data is not valid.",
      );
    }
  }

  // `all: true` keeps repeated field names as arrays. Without it a second
  // picture under `images` silently replaces the first, and a comment keeps
  // only one of the files it sent.
  const files = filesFrom(parsed[field]);

  return { body, files };
};

const uploadOne = async (
  file: File,
  options: IUploadOptions,
): Promise<TUploadedFile> => {
  try {
    return await uploadToCloudinary(file, {
      fieldname: options.field,
      resourceType: options.resourceType,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    // eslint-disable-next-line no-console
    console.error(`Cloudinary upload failed for ${options.field}:`, message);
    throw new AppError(
      httpStatus.BAD_GATEWAY,
      "The image could not be uploaded. Try again.",
    );
  }
};

export default withUploads;
