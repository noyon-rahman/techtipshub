"use client";

import { Skeleton } from "@heroui/skeleton";

/**
 * Loading state for the article editor.
 *
 * `[slug]/loading.tsx` beside it describes the published article; it would be
 * the wrong shape here and flash over the editor on every article opened. This
 * one traces the editor's own first screen - a label, a display-width title
 * line and the body block - inside the same frame the composer uses.
 */
const EditBlogLoading = () => (
  <section className="pt-4" aria-busy="true" aria-live="polite">
    <div className="mx-auto w-full max-w-page px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-read space-y-6 py-8">
        <Skeleton className="h-4 w-28 rounded-md" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-11/12 rounded" />
          <Skeleton className="h-4 w-4/5 rounded" />
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </div>
  </section>
);

export default EditBlogLoading;
