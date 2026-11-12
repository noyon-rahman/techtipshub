"use client";

import { focusRing } from "./tau";

/**
 * The bar that appears once rows are ticked.
 *
 * It sits between the toolbar and the table rather than floating over it: a
 * fixed bar would cover the rows the admin is still choosing from, and at
 * 360px it would cover most of them.
 *
 * It takes both noun forms instead of appending an "s", because "categorys"
 * is not a word.
 */
export default function SelectionBar({
  count,
  noun,
  pluralNoun = `${noun}s`,
  onClear,
  children,
}: {
  count: number;
  /** Singular noun: "article", "member", "category", "comment". */
  noun: string;
  /** Only for nouns that do not just take an "s". */
  pluralNoun?: string;
  onClear: () => void;
  /** The actions, on the right. */
  children: React.ReactNode;
}) {
  if (count === 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-primary/30 bg-primary/5 px-3 py-2">
      <div className="flex items-center gap-3">
        <p className="text-sm text-foreground" role="status">
          <span className="font-semibold tabular-nums">{count}</span>{" "}
          {count === 1 ? noun : pluralNoun} selected
        </p>
        <button
          type="button"
          onClick={onClear}
          className={`inline-flex min-h-11 items-center rounded-sm text-xs text-default-600 underline-offset-4 hover:underline sm:min-h-9 ${focusRing}`}
        >
          Clear selection
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}
