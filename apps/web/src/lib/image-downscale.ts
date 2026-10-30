/**
 * A smaller copy of a picked photo, before it leaves the browser.
 *
 * A 4 MB phone photo of a painting is not a better article cover than the same
 * photo at 1600 px wide, but it is four times the upload, and the direct upload
 * costs the writer's connection rather than a function's, so shrinking it first
 * is what keeps a publish feeling quick.
 */

/** Formats a canvas can re-encode without losing something worth keeping. */
const RESIZABLE = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

/** Output quality: visually indistinguishable at this size, far smaller. */
const QUALITY = 0.85;

type CanvasSource = HTMLCanvasElement | OffscreenCanvas;

const makeCanvas = (width: number, height: number): CanvasSource | null => {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      return new OffscreenCanvas(width, height);
    }
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
  } catch {
    // No canvas in this build or worker: the caller keeps the original.
  }
  return null;
};

const toBlob = (canvas: CanvasSource): Promise<Blob | null> => {
  if ("convertToBlob" in canvas) {
    return canvas
      .convertToBlob({ type: "image/jpeg", quality: QUALITY })
      .catch(() => null);
  }

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", QUALITY);
  });
};

/**
 * Returns `file` sized down to `maxWidth` at most, or the file itself.
 *
 * It never throws and never rejects: a cover that cannot be decoded here is
 * still a cover the writer chose, and refusing it would leave them with a
 * publish that fails for a reason they cannot see or fix.
 */
export const downscaleImage = async (
  file: File,
  maxWidth = 1600,
): Promise<File> => {
  if (!file.type.startsWith("image/")) return file;
  // A GIF's frames and an SVG's drawing instructions are not pixels, and
  // drawing either into a canvas flattens the first and can taint the second.
  if (!RESIZABLE.has(file.type.toLowerCase())) return file;
  if (typeof createImageBitmap !== "function") return file;

  let bitmap: ImageBitmap | null = null;

  try {
    bitmap = await createImageBitmap(file);
    const width = bitmap.width;
    const height = bitmap.height;

    if (width <= maxWidth) return file;

    const scale = maxWidth / width;

    const canvas = makeCanvas(
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    );

    const context = canvas?.getContext("2d") as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null
      | undefined;
    if (!canvas || !context) return file;

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const blob = await toBlob(canvas);
    // A photo that compresses to more than the original is not an improvement.
    if (!blob || blob.size >= file.size) return file;

    return new File([blob], withJpegName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  } finally {
    // Every path above hands back a plain File built from its own bytes, so the
    // decoded bitmap is never needed past this point, and it is the largest
    // thing the function allocates on its own.
    bitmap?.close();
  }
};

/** `cover.png` becomes `cover.jpg`; a name with no extension gets one. */
const withJpegName = (name: string) => {
  const base = name.replace(/\.[^./\\]+$/, "");
  return `${base || "cover"}.jpg`;
};
