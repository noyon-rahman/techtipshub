"use client";

import { focusRing } from "@/components/modules/admin/kit/tau";
import type {
  INewsletterCounts,
  TSubscriberStatus,
} from "@/services/admin/newsletter";
import { useRef, type KeyboardEvent } from "react";

import { SUBSCRIBER_LABEL } from "./labels";

export type SubscriberFilter = TSubscriberStatus | "all";

const TABS: SubscriberFilter[] = [
  "all",
  "active",
  "unsubscribed",
  "bounced",
  "complained",
];

interface IProps {
  counts: INewsletterCounts;
  status: SubscriberFilter;
  onChange: (status: SubscriberFilter) => void;
}

/**
 * The status tabs, with the counts the API returned for the whole list.
 *
 * The counts come from the same answer as the rows, so a tab never shows a
 * number that belongs to a different filter. One tab stop for the row: arrow
 * keys walk it and Home/End jump to the ends.
 */
const SubscriberFilters = ({ counts, status, onChange }: IProps) => {
  const tablistRef = useRef<HTMLDivElement>(null);

  const countFor = (key: SubscriberFilter) =>
    key === "all" ? counts.total : counts[key];

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = Math.max(0, TABS.indexOf(status));
    let next: number | undefined;

    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;

    if (next === undefined) return;
    event.preventDefault();
    onChange(TABS[next]);
    tablistRef.current
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [next]?.focus();
  };

  return (
    <div
      ref={tablistRef}
      role="tablist"
      aria-label="Filter subscribers by status"
      onKeyDown={onKeyDown}
      className="-mx-1 flex min-w-0 items-center gap-0.5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {TABS.map((key) => {
        const selected = key === status;
        const count = countFor(key);

        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(key)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[0.8125rem] font-medium transition-colors lg:min-h-10 ${focusRing} ${
              selected
                ? "border-primary text-foreground"
                : "border-transparent text-default-600 hover:text-foreground"
            }`}
          >
            {key === "all" ? "All" : SUBSCRIBER_LABEL[key]}
            <span
              className={`tabular-nums ${
                selected ? "text-primary-accessible" : "text-default-600"
              }`}
            >
              {count.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default SubscriberFilters;
