"use client";

import { useAdminShell } from "@/components/shared/admin-sidebar/admin-shell";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface IProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  meta?: ReactNode;
  /** Render the visible title and description (used on Dashboard for the greeting). */
  showHeading?: boolean;
}

/**
 * Heading block for admin screens. The top bar already displays the active
 * screen's title, so by default this keeps a screen-reader `<h1>`, portals
 * page `actions` into `#admin-topbar-actions` on `sm+` (leaving them in a
 * compact mobile row below `sm`), and renders `meta` if provided.
 */
export default function AdminPageHeader({
  title,
  description,
  actions,
  meta,
  showHeading = false,
}: IProps) {
  const { setHasPageActions } = useAdminShell();
  const [topbarSlot, setTopbarSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const slot = document.getElementById("admin-topbar-actions");
    setTopbarSlot(slot);
    setHasPageActions(Boolean(actions && slot));

    return () => {
      setHasPageActions(false);
    };
  }, [actions, setHasPageActions]);

  const portaledActions =
    actions && topbarSlot ? createPortal(actions, topbarSlot) : null;

  if (!showHeading) {
    return (
      <>
        <h1 className="sr-only">{title}</h1>
        {portaledActions}
        {(meta || (actions && !topbarSlot)) && (
          <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
            {meta ? (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-default-600">
                {meta}
              </div>
            ) : (
              <span />
            )}
            {actions && (
              <div
                className={`-mx-1 flex shrink-0 flex-wrap items-center gap-2 sm:mx-0 sm:justify-end ${
                  topbarSlot ? "sm:hidden" : ""
                }`}
              >
                {actions}
              </div>
            )}
          </header>
        )}
        {actions && topbarSlot && !meta && (
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2 sm:hidden">
            {actions}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {portaledActions}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-balance font-[family-name:var(--type-editorial)] text-[1.5rem] font-semibold leading-[1.1] tracking-[-0.02em] sm:text-[1.75rem]">
            {title}
          </h1>
          {description && (
            <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-default-600">
              {description}
            </p>
          )}
          {meta && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-default-600">
              {meta}
            </div>
          )}
        </div>

        {actions && (
          <div
            className={`-mx-1 flex shrink-0 flex-wrap items-center gap-2 sm:mx-0 sm:justify-end ${
              topbarSlot ? "sm:hidden" : ""
            }`}
          >
            {actions}
          </div>
        )}
      </header>
    </>
  );
}
