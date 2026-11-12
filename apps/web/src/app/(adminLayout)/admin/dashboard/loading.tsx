"use client";

import { Skeleton } from "@heroui/skeleton";

/**
 * Route-level skeleton. It mirrors the dashboard's real layout, so the frame
 * does not jump when the data arrives: the 4-tile headline row, the 2-column
 * activity + health row, and the 3-column lists row.
 */
const AdminDashboardLoading = () => (
  <div className="space-y-5" role="status">
    <span className="sr-only">Loading the dashboard</span>

    <div className="mb-6 space-y-2">
      <Skeleton className="h-7 w-56 rounded" />
      <Skeleton className="h-4 w-80 max-w-full rounded" />
    </div>

    <div className="grid grid-cols-2 divide-x divide-y divide-default/60 overflow-hidden rounded-xl border border-default/60 bg-content-1 sm:grid-cols-4 sm:divide-y-0">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className={`space-y-3 p-4 sm:p-5 ${
            index >= 2 ? "border-t border-default/60 sm:border-t-0" : ""
          }`}
        >
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
      ))}
    </div>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
      <div className="min-w-0 rounded-xl border border-default/60 bg-content-1 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-default/60 pb-3">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-48 rounded" />
            <Skeleton className="h-3 w-64 max-w-full rounded" />
          </div>
          <Skeleton className="h-8 w-44 rounded-md" />
        </div>
        <Skeleton className="mt-4 h-64 w-full rounded-md" />
      </div>

      <div className="min-w-0 rounded-xl border border-default/60 bg-content-1 p-4 sm:p-5">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="mt-1.5 h-3 w-52 rounded" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </div>
    </div>

    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="rounded-xl border border-default/60 bg-content-1 p-4 sm:p-5"
        >
          <Skeleton className="h-4 w-36 rounded" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((__, row) => (
              <Skeleton key={row} className="h-10 w-full rounded-md" />
            ))}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default AdminDashboardLoading;
