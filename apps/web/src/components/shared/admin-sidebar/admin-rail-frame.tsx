"use client";

import { useAdminShell } from "./admin-shell";

/**
 * The one place the rail's width is written: the fixed rail reads it, and the
 * content column reserves it. Collapsing swaps it to the icon rail.
 *
 * `lg:` and `data-` are never chained into a single utility here. Tailwind
 * emits `lg:data-[…]:w-…` outside its media query, and a phone matches the
 * `data-*` too, which would shrink the tablet drawer.
 */
export function AdminRailFrame({ children }: { children: React.ReactNode }) {
  const { isRailCollapsed } = useAdminShell();

  return (
    <div
      data-rail-collapsed={isRailCollapsed ? "true" : undefined}
      className="min-h-dvh bg-default-100/60 [--admin-rail-width:auto] transition-[padding] duration-200 dark:bg-[#0D0C0E] lg:pl-[var(--admin-rail-width)] lg:[--admin-rail-width:15rem] data-[rail-collapsed=true]:[--admin-rail-width:4rem]"
    >
      {children}
    </div>
  );
}
