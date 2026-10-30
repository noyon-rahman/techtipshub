/**
 * Cover images, uploaded through the API the moment the writer picks one.
 *
 * Not a `"use server"` module, on purpose: a server action would cap the body
 * and buffer the file twice, once to receive it and once to forward it. The
 * route the browser calls (`/api/v1/uploads/cover`) forwards the stream to the
 * API, which stores the file in Cloudinary and answers with its URL and id.
 *
 * `axiosInstance` is written for the browser already (see
 * `src/lib/AxiosInstance`), so the request goes out as `/api/v1/...` and
 * carries the session cookie the same way the vote and follow calls do.
 */

import { messageOf } from "@/lib/api-error";
import axiosInstance from "@/lib/AxiosInstance";
import { downscaleImage } from "@/lib/image-downscale";
import { COVER_TOO_LARGE } from "@/lib/upload-limits";

/** A cover that is stored and owned by the API, not yet published. */
export interface ICoverAsset {
  url: string;
  publicId: string;
}

/** The API's own envelope around the upload answer. */
interface ICoverBody {
  data?: Partial<ICoverAsset>;
}

const UPLOAD_FAILED = "The upload did not finish. Try again.";
const SIGNED_OUT = "Your session ended. Sign in again to change the cover.";

/**
 * What to tell the writer when the upload is refused.
 *
 * The API's own sentence is used where it names something the writer can act
 * on (a lost session, an oversized file); the rest are the API's path failing,
 * which the writer can only answer by trying again.
 */
const describeUploadFailure = (error: unknown) => {
  const status = (error as { response?: { status?: number } } | null)?.response
    ?.status;

  if (status === 413) return COVER_TOO_LARGE;
  if (status === 401) return SIGNED_OUT;
  // 429 and 403 carry a reason worth repeating; 400 and 5xx are ours to fix,
  // and the API's wording for them ("Cloudinary upload failed") says nothing.
  if (status === 429 || status === 403)
    return messageOf(error) ?? UPLOAD_FAILED;
  return UPLOAD_FAILED;
};

/**
 * Uploads a cover and returns what the article will point at.
 *
 * The file is shrunk first (see `downscaleImage`): the writer waits through
 * this upload, and a 1600 px copy of a phone photo is a fraction of the bytes.
 * `onProgress` reads `null` once the body is out and only the API's Cloudinary
 * call is left, so the strip can say "finishing" instead of sitting at 100%.
 */
export const uploadCover = async (
  file: File,
  onProgress?: (fraction: number | null) => void,
): Promise<ICoverAsset> => {
  const reduced = await downscaleImage(file);
  const form = new FormData();
  form.append("image", reduced, reduced.name || "cover.jpg");

  let res;
  try {
    res = await axiosInstance.post<ICoverBody>("/uploads/cover", form, {
      onUploadProgress: (event) => {
        if (!event.total) return;
        onProgress?.(Math.min(1, event.loaded / event.total));
      },
    });
  } catch (error) {
    throw new Error(describeUploadFailure(error));
  }

  const data = res.data?.data;
  if (!data?.url || !data.publicId) {
    // A 200 without a URL is the API and the web app disagreeing about the
    // shape, not something the writer did.
    throw new Error(UPLOAD_FAILED);
  }

  onProgress?.(null);
  return { url: data.url, publicId: data.publicId };
};

/**
 * Deletes an asset this browser uploaded and never published.
 *
 * Never throws and never toasts: it runs while the writer is replacing a cover
 * or leaving the composer, and a failure there is not theirs to answer. An
 * expired session skips the delete, because the API refuses it and the leave
 * the writer is already making matters more than one orphaned image.
 */
export const deleteCoverAsset = async (publicId: string): Promise<void> => {
  try {
    await axiosInstance.delete("/uploads/asset", { data: { publicId } });
  } catch {
    // Expired session, offline, or already gone: the asset is left in
    // Cloudinary, which is the acceptable outcome.
  }
};
