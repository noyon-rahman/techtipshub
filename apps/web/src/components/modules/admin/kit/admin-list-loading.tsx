"use client";

import { Skeleton } from "@heroui/skeleton";

/**
 * Route-level fallback for a list screen: the header, the card and the toolbar
 * row the page loads into, so the frame does not change shape when data lands.
 * `tabs` draws the count chips the screen will have; `action` is the page's
 * top-right button.
 */
export default function AdminListLoading({
  label,
  tabs = 0,
  action = true,
}: {
  label: string;
  tabs?: number;
  action?: boolean;
}) {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Loading {label}
      </p>

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4 sm:flex-nowrap">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40 rounded" />
          <Skeleton className="h-3 w-80 max-w-full rounded" />
        </div>
        {action ? (
          <Skeleton className="h-9 w-36 shrink-0 rounded-[12px]" />
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-default/60">
        <div className="flex flex-col gap-2 border-b border-default/60 p-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3 sm:px-3 sm:py-2">
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.max(tabs, 1) }).map((_, index) =>
              tabs > 0 ? (
                <Skeleton
                  key={index}
                  className="h-11 w-24 rounded-[6px] sm:h-9"
                />
              ) : (
                <span key={index} className="hidden h-9 w-24 sm:block" />
              ),
            )}
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-11 w-full rounded-[6px] sm:h-9 sm:w-64" />
            <Skeleton className="hidden h-9 w-24 rounded-[6px] sm:block" />
          </div>
        </div>

        <div className="divide-y divide-default/50">
          {Array.from({ length: 8 }).map((_, row) => (
            <div key={row} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="size-10 shrink-0 rounded-md" />
              <div className="min-w-0 flex-1 space-y-2">
                <Skeleton className="h-3 w-52 max-w-full rounded" />
                <Skeleton className="h-3 w-32 rounded" />
              </div>
              <Skeleton className="hidden h-3 w-24 rounded lg:block" />
              <Skeleton className="hidden h-3 w-16 rounded sm:block" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-default/60 bg-default-50/40 px-3 py-2">
          <Skeleton className="h-3 w-32 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
      </div>
    </div>
  );
}
