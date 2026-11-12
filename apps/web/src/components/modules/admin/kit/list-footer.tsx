"use client";

import type { ReactNode } from "react";
import AdminPagination from "./pagination";

interface IProps {
  /** Total rows the API reported, for the whole set and not this page. */
  total?: number;
  /** Rows on the page. */
  shown: number;
  /** What one row is called, e.g. "article". */
  noun: string;
  /** Only for nouns that do not just take an "s", e.g. "categories". */
  pluralNoun?: string;
  page: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /** Extra filters applied to the set, said after the total. */
  context?: ReactNode;
  /** Shown instead of the count while the first request is in flight. */
  isLoading?: boolean;
  /**
   * The list above failed. A count under an error message would state "0
   * articles" and read as an empty set, so the strip drops to the rule alone.
   */
  isError?: boolean;
}

const num = (value: number) => value.toLocaleString("en-GB");

const strip = "border-t border-default/60 bg-default-50/40 px-3 py-2";

/**
 * The one footer under an admin list. A single rule and one tinted strip hold
 * both the count and the pager, so a list never ends in two stacked rules. The
 * pager keeps its own border off here because the strip already draws it.
 *
 * The count states the whole set and the page window, which is what a reader
 * checking "did my filter work" needs: "143 articles, 21-40 shown".
 */
export default function ListFooter({
  total,
  shown,
  noun,
  pluralNoun = `${noun}s`,
  page,
  totalPages,
  pageSize,
  onPageChange,
  context,
  isLoading = false,
  isError = false,
}: IProps) {
  if (isError) return null;

  if (isLoading && total === undefined) {
    return (
      <div className={`${strip} text-xs text-default-600`}>
        <span role="status">Counting {pluralNoun}</span>
      </div>
    );
  }

  const first = (page - 1) * pageSize + 1;
  const last = first + Math.max(shown, 0) - 1;
  const count = total ?? shown;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 ${strip}`}
    >
      <p className="min-w-0 text-xs tabular-nums text-default-600">
        <span className="font-medium text-foreground">
          {num(count)} {count === 1 ? noun : pluralNoun}
        </span>
        {shown > 0 ? (
          <>
            {", "}
            {num(first)}-{num(last)} shown
          </>
        ) : null}
        {context ? <span>{context}</span> : null}
      </p>

      <AdminPagination
        page={page}
        totalPages={totalPages}
        onPageChange={onPageChange}
        chrome="bare"
      />
    </div>
  );
}
