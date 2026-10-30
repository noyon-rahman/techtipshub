"use client";

import {
  deleteCoverAsset,
  uploadCover,
  type ICoverAsset,
} from "@/services/upload";
import { useCallback, useEffect, useRef, useState } from "react";
import { useObjectUrl } from "./use-stored-upload";

export type TCoverStatus = "idle" | "uploading" | "failed";

/**
 * A cover on its way out of the browser, from the moment it is picked.
 *
 * The composer and the editor share this so there is one answer to "which
 * image will the article be given, and who may delete it". A picked file is
 * uploaded at once and its asset is held here; whatever the screen does with
 * it next, this hook is the only place that deletes an asset, so the rule is
 * kept once: only an asset this screen uploaded may be deleted.
 *
 * Assets live and die with the screen, so leaving without using them deletes
 * them. A hard tab close may beat that request; one orphaned image is cheaper
 * than a cron job for it.
 */
export const useCoverAsset = () => {
  const [asset, setAssetState] = useState<ICoverAsset | null>(null);
  // The file itself is only kept for the preview: what the article will be
  // given is the asset, so nothing downstream reads the bytes again.
  const [file, setFile] = useState<File | null>(null);
  const fileUrl = useObjectUrl(file);
  const [status, setStatus] = useState<TCoverStatus>("idle");
  // 0 to 1 while the file travels, then null while the API stores it.
  const [progress, setProgress] = useState<number | null>(null);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);

  // The async upload and the unmount cleanup both read these outside a render.
  const current = useRef<ICoverAsset | null>(null);
  const published = useRef(false);
  // Bumped per pick, so an upload that finishes after a newer pick cannot
  // install an image the writer already replaced.
  const picked = useRef(0);

  const setAsset = useCallback((next: ICoverAsset | null) => {
    current.current = next;
    setAssetState(next);
  }, []);

  // Records the asset as part of the article, so it outlives this screen.
  const keep = useCallback(() => {
    published.current = true;
    setAsset(null);
  }, [setAsset]);

  const drop = useCallback(() => {
    const held = current.current;
    setAsset(null);
    setFile(null);
    if (held) void deleteCoverAsset(held.publicId);
  }, [setAsset]);

  /**
   * Uploads `file` now, replacing whatever this screen was holding.
   *
   * `replace` runs once the new asset is stored: it is where the previous
   * asset is deleted, because deleting it first would lose both covers if the
   * upload failed. A failure leaves the held asset and the file's preview for
   * the writer to retry with.
   */
  const pick = useCallback(
    async (file: File, replace?: (previous: ICoverAsset) => void) => {
      const ticket = ++picked.current;
      setFile(file);
      setStatus("uploading");
      setFailedMessage(null);
      setProgress(0);

      try {
        const next = await uploadCover(file, setProgress);
        if (ticket !== picked.current) {
          // Replaced while this one was in flight: it was never shown, so it
          // is deleted rather than left behind.
          void deleteCoverAsset(next.publicId);
          return;
        }

        const previous = current.current;
        current.current = next;
        setAssetState(next);
        setStatus("idle");
        setProgress(null);

        if (previous) {
          if (replace) replace(previous);
          else void deleteCoverAsset(previous.publicId);
        }
      } catch (error) {
        if (ticket !== picked.current) return;
        // The file stays, so the strip shows the image that failed and the
        // writer can pick it again rather than face an empty cover.
        setStatus("failed");
        setProgress(null);
        setFailedMessage(
          error instanceof Error && error.message
            ? error.message
            : "The upload did not finish. Try again.",
        );
      }
    },
    [],
  );

  useEffect(
    () => () => {
      if (!published.current && current.current) {
        void deleteCoverAsset(current.current.publicId);
      }
    },
    [],
  );

  return {
    asset,
    file,
    fileUrl,
    status,
    progress,
    failedMessage,
    pick,
    drop,
    keep,
    setAsset,
  };
};
