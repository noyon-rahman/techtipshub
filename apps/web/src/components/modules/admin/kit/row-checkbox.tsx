"use client";

import { useEffect, useRef } from "react";
import { focusRing } from "./tau";

/**
 * The tick in a table's first column.
 *
 * A native checkbox sized for a mouse and skinned by the browser would be the
 * only control on these screens that looks borrowed, so the box is drawn from
 * the kit's hairline and the amber is a fill, never text. It keeps the native
 * input underneath: Space toggles it, a screen reader announces it, and the
 * header box is `mixed` while only some rows on the page are picked.
 */
export default function RowCheckbox({
  label,
  checked,
  indeterminate = false,
  disabled = false,
  onChange,
}: {
  /** Names the row or the column, spoken by the screen reader only. */
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  // `indeterminate` is a property, not an attribute, so React cannot set it.
  useEffect(() => {
    if (input.current) input.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className="relative inline-flex size-4 items-center justify-center">
      <input
        ref={input}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        className={`peer size-4 cursor-pointer appearance-none rounded-[4px] border border-default-300 bg-background transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`}
      />
      {/* The tick and the dash are drawn here because a native control's
          marks cannot take the theme's ink colour. */}
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className={`pointer-events-none absolute size-3 ${
          checked ? "opacity-100" : "opacity-0"
        }`}
      >
        <path
          d="M13 4.5 6.5 11 3 7.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-primary-foreground"
        />
      </svg>
      {!checked && indeterminate ? (
        <span
          aria-hidden
          className="pointer-events-none absolute h-0.5 w-2 bg-primary-foreground"
        />
      ) : null}
    </span>
  );
}
