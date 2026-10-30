"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LuImagePlus, LuTrash2, LuUpload } from "react-icons/lu";
import { COVER_TOO_LARGE, tooLargeForCoverUpload } from "@/lib/upload-limits";

/** Where the cover strip stands: what the writer is told, and what waits. */
export type TCoverPhase = "ready" | "uploading" | "failed";

interface IProps {
  /**
   * The file picked for this cover. It shows while the upload is in flight,
   * and again if the upload failed, so the strip never goes blank.
   */
  file: File | null;
  onChange: (file: File | null) => void;
  invalid?: boolean;
  /** A cover already stored on the blog, shown until a replacement is chosen. */
  existing?: string | null;
  /**
   * Called when "Remove" is pressed on anything other than a fresh file:
   * either the stored cover, or one this session uploaded.
   */
  onRemoveExisting?: () => void;
  /**
   * How much of the cover has gone to the server while it uploads. A number is
   * the file on its way out, `null` is the server storing it, and absent means
   * nothing is uploading and the strip shows its preview.
   */
  progress?: number | null;
  /** Why the last upload did not finish. The picker is the retry. */
  failedMessage?: string | null;
  /** False while the picker itself has to stay shut (a guest, or a save in flight). */
  canPick?: boolean;
}

/**
 * Cover image band.
 *
 * Empty it is a slim dashed strip rather than a large empty box, so the title
 * stays the first thing on the page. It accepts a click, a drop and a file
 * dialog, and shows the chosen image in the shape the article header uses.
 *
 * The cover leaves the browser the moment it is picked, so the strip owns the
 * upload's progress and its failure. On the edit screen `existing` is the
 * saved cover: choosing a file replaces it, and "Remove" clears it.
 */
const CoverUpload = ({
  file,
  onChange,
  invalid,
  existing,
  onRemoveExisting,
  progress,
  failedMessage,
  canPick = true,
}: IProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Object URLs are derived from the file, so they are created during render
  // (not in an effect) and only revoked once they are replaced or unmounted.
  const preview = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview);
  }, [preview]);

  const accept = (candidate: File | undefined) => {
    if (!candidate || !canPick) return;
    if (!candidate.type.startsWith("image/")) {
      setError("That file is not an image.");
      return;
    }
    if (tooLargeForCoverUpload(candidate.size)) {
      setError(COVER_TOO_LARGE);
      return;
    }
    setError(null);
    onChange(candidate);
  };

  // A stored cover only goes through `onRemoveExisting`, because its file is
  // not this one; anything this screen holds is cleared with `onChange(null)`.
  // Neither asks permission, because a cover on screen that cannot be removed
  // is a dead end: a failed upload has no asset to protect, and a saved cover
  // is the caller's to hide.
  const remove = () => {
    if (existing && onRemoveExisting) {
      onRemoveExisting();
      return;
    }
    onChange(null);
  };

  // A dropped file is ignored while the picker is shut, rather than accepted
  // into a screen that cannot upload it.
  const dropHandlers = canPick
    ? {
        onDragOver: (event: React.DragEvent) => {
          event.preventDefault();
          setDragging(true);
        },
        onDragLeave: () => setDragging(false),
        onDrop: (event: React.DragEvent) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files?.[0]);
        },
      }
    : {};

  // The saved cover only shows until the writer picks or removes one - the
  // caller decides that by passing `existing` (or null).
  const shownPreview = preview ?? existing ?? null;

  // Where the upload has got to, for the label and the bar. Rounded here so the
  // text and the bar never disagree about whether it is finished.
  const uploading = typeof progress === "number" && progress !== null;
  const finishing = uploading === false && progress === null;
  const percent = uploading ? Math.min(100, Math.round(progress * 100)) : null;
  const failed = !uploading && !finishing && Boolean(failedMessage);
  const phase: TCoverPhase = uploading
    ? "uploading"
    : failed
      ? "failed"
      : "ready";

  const details = [
    file
      ? `${file.name}, ${Math.max(1, Math.round(file.size / 1024))} KB`
      : null,
    uploading
      ? `uploading ${percent}%`
      : finishing
        ? "uploading, finishing"
        : failed
          ? "upload failed"
          : existing && !preview
            ? "current cover"
            : "ready",
  ]
    .filter(Boolean)
    .join(", ");

  const busyUploading = uploading || finishing;

  return (
    <div>
      {shownPreview ? (
        <div
          className={`group relative overflow-hidden rounded-xl border ${
            dragging
              ? "border-primary ring-2 ring-primary/30"
              : failed
                ? "border-danger"
                : "border-default-200"
          }`}
          {...dropHandlers}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shownPreview}
            alt="Cover"
            className="h-40 w-full object-cover sm:h-52 md:h-60"
          />
          <div className="absolute inset-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 via-transparent p-3">
            <span
              className={`rounded-md bg-black/50 px-2 py-1 text-xs text-white/90 backdrop-blur ${
                busyUploading ? "" : "hidden sm:inline"
              }`}
            >
              {uploading
                ? `Uploading ${percent}%`
                : finishing
                  ? "Finishing upload"
                  : failed
                    ? "Upload failed"
                    : existing && !preview
                      ? "Current cover"
                      : "New cover"}
            </span>
            <div
              className={`flex gap-2 sm:opacity-0 sm:transition-opacity sm:group-focus-within:opacity-100 sm:group-hover:opacity-100 ${
                busyUploading ? "pointer-events-none opacity-0" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={busyUploading || !canPick}
                className="flex min-h-11 items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5 text-xs text-white backdrop-blur transition-colors hover:bg-black/80 focus-visible:opacity-100 disabled:opacity-60 sm:min-h-0"
              >
                <LuUpload className="size-3.5" />
                Replace
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busyUploading}
                className="flex min-h-11 items-center gap-1.5 rounded-md bg-black/60 px-2.5 py-1.5 text-xs text-white backdrop-blur transition-colors hover:bg-black/80 focus-visible:opacity-100 disabled:opacity-60 sm:min-h-0"
              >
                <LuTrash2 className="size-3.5" />
                Remove
              </button>
            </div>
          </div>
          {uploading && percent !== null && (
            <div
              className="absolute inset-x-0 bottom-0 h-1 bg-black/30"
              role="progressbar"
              aria-label="Cover upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
            >
              <div
                className="h-full bg-primary transition-[width] duration-150"
                style={{ width: `${percent}%` }}
              />
            </div>
          )}
          {finishing && (
            <div
              className="absolute inset-x-0 bottom-0 h-1 bg-black/30"
              role="progressbar"
              aria-label="Cover upload progress"
              aria-valuetext="Finishing"
            >
              <div className="h-full w-full animate-pulse bg-primary" />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          id="composer-cover"
          onClick={() => inputRef.current?.click()}
          {...dropHandlers}
          disabled={!canPick}
          title="Add a cover image, or drop one here"
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-[0.8125rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 disabled:opacity-60 sm:min-h-8 ${
            dragging
              ? "bg-primary-50/40 text-primary-accessible"
              : invalid
                ? "text-danger"
                : "text-default-600 hover:bg-default-100 hover:text-foreground"
          }`}
        >
          <LuImagePlus className="size-4 shrink-0" />
          Add a cover (required)
        </button>
      )}

      {/* The strip's state in words: the label over the image is short, and this
          is what a screen reader hears and what a failed upload explains. */}
      <p
        className={failed ? "mt-2 text-sm text-danger" : "sr-only"}
        role="status"
      >
        {failed
          ? `${failedMessage} Pick the image again to retry.`
          : phase === "uploading"
            ? `Uploading the cover, ${percent}%`
            : details || "No cover chosen."}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={!canPick}
        onChange={(event) => {
          accept(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {error && (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

export default CoverUpload;
