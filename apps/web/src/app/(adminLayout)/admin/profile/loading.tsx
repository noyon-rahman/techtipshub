"use client";

import { Skeleton } from "@heroui/react";

const AdminProfileLoading = () => (
  <div className="space-y-6" role="status">
    <span className="sr-only">Loading admin profile</span>

    <div className="space-y-2">
      <Skeleton className="h-7 w-40 rounded-md" />
      <Skeleton className="h-4 w-80 max-w-full rounded-md" />
    </div>

    <div className="rounded-xl border border-default/60 bg-content-1 p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <Skeleton className="size-20 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2.5">
          <Skeleton className="h-6 w-48 rounded-md" />
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-4 w-72 max-w-full rounded-md" />
        </div>
      </div>
    </div>

    <div className="rounded-xl border border-default/60 bg-content-1 p-5 space-y-3">
      <Skeleton className="h-5 w-36 rounded-md" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  </div>
);

export default AdminProfileLoading;

