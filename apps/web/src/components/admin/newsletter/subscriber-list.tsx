"use client";

import { formatExact, formatRelative, isoDate } from "@/components/admin/utils";
import { quietButton } from "@/components/admin/list-controls";
import EmptyState from "@/components/modules/admin/kit/empty-state";
import { focusRing } from "@/components/modules/admin/kit/tau";
import type {
  INewsletterCounts,
  INewsletterSubscriber,
  TSubscriberStatus,
} from "@/services/admin/newsletter";
import { Skeleton } from "@heroui/skeleton";
import { useId, useRef, type KeyboardEvent } from "react";
import { FiMail, FiTrash2 } from "react-icons/fi";

import {
  SOURCE_LABEL,
  SUBSCRIBER_LABEL,
  SUPPRESS_REASON,
  canRemove,
} from "./labels";
import SubscriberFilters, { type SubscriberFilter } from "./subscriber-filters";

interface IListProps {
  rows: INewsletterSubscriber[];
  total: number;
  isLoading: boolean;
  isFetching: boolean;
  failed: boolean;
  failedMessage?: string;
  onRetry: () => void;
  status: SubscriberFilter;
  onStatusChange: (status: SubscriberFilter) => void;
  counts: INewsletterCounts;
  searchTerm: string;
  onClearSearch: () => void;
  /** Removing takes a round trip, so the row it belongs to says so. */
  removingEmail?: string;
  deletingId?: string;
  onRemove: (subscriber: INewsletterSubscriber) => void;
  onDeletePermanent: (subscriber: INewsletterSubscriber) => void;
}

const statusTone: Record<TSubscriberStatus, string> = {
  active: "border-success/40 bg-success/10 text-foreground",
  unsubscribed: "border-default-300 bg-default-50 text-default-700",
  bounced: "border-danger/40 bg-danger/10 text-foreground",
  complained: "border-danger/40 bg-danger/10 text-foreground",
};

const StatusPill = ({ status }: { status: TSubscriberStatus }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium ${statusTone[status]}`}
  >
    {SUBSCRIBER_LABEL[status]}
  </span>
);

/**
 * The subscriber list.
 *
 * A table on a wide screen and a stack of cards on a phone, from the same
 * markup: each row is a `grid` that reflows, so there is one copy of the data
 * and one order to tab through. Rows are not clickable: the only action is
 * removing an address, which is a button of its own.
 */
const SubscriberList = ({
  rows,
  total,
  isLoading,
  isFetching,
  failed,
  failedMessage,
  onRetry,
  status,
  onStatusChange,
  counts,
  searchTerm,
  onClearSearch,
  removingEmail,
  deletingId,
  onRemove,
  onDeletePermanent,
}: IListProps) => {
  const listRef = useRef<HTMLUListElement>(null);
  const headerId = useId();

  const move = (event: KeyboardEvent<HTMLUListElement>) => {
    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-subscriber-row="true"] button',
      ) ?? [],
    );
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index === -1) return;

    let next: number | undefined;

    if (event.key === "ArrowDown")
      next = Math.min(buttons.length - 1, index + 1);
    else if (event.key === "ArrowUp") next = Math.max(0, index - 1);

    if (next === undefined) return;
    event.preventDefault();
    buttons[next]?.focus();
  };

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 py-2">
      <SubscriberFilters
        counts={counts}
        status={status}
        onChange={onStatusChange}
      />
      {searchTerm && (
        <p className="min-w-0 truncate text-xs text-default-600">
          searching “{searchTerm}”
        </p>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div>
        <div className="border-b border-default/60">{toolbar}</div>
        <ul className="divide-y divide-default/60" aria-hidden>
          {Array.from({ length: 8 }).map((_, index) => (
            <li key={index} className="flex items-center gap-4 px-3.5 py-3">
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
              <Skeleton className="ml-auto h-4 w-16 rounded" />
            </li>
          ))}
        </ul>
        <p className="sr-only" role="status">
          Loading subscribers
        </p>
      </div>
    );
  }

  if (failed) {
    return (
      <div>
        <div className="border-b border-default/60">{toolbar}</div>
        <EmptyState
          variant="inline"
          icon={<FiMail className="size-5" />}
          title="The list could not be loaded"
          description={
            failedMessage ||
            "The request to the API failed. Try again, and if it keeps failing check that the API is reachable."
          }
          action={
            <button type="button" onClick={onRetry} className={quietButton}>
              Try again
            </button>
          }
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div>
        <div className="border-b border-default/60">{toolbar}</div>
        {searchTerm ? (
          <EmptyState
            variant="inline"
            icon={<FiMail className="size-5" />}
            title="Nothing matches that search"
            description={`No name or address in ${status === "all" ? "the list" : `the ${SUBSCRIBER_LABEL[status].toLowerCase()} view`} contains "${searchTerm}".`}
            action={
              <button
                type="button"
                onClick={onClearSearch}
                className={quietButton}
              >
                Clear search
              </button>
            }
          />
        ) : status === "all" ? (
          <EmptyState
            variant="inline"
            icon={<FiMail className="size-5" />}
            title="Nobody on the list yet"
            description="Readers join from the signup form in the footer, on the feed, at the end of an article, or with the switch on their profile."
          />
        ) : (
          <EmptyState
            variant="inline"
            icon={<FiMail className="size-5" />}
            title={`Nobody is ${SUBSCRIBER_LABEL[status].toLowerCase()}`}
            description="All holds everyone, whatever their status."
            action={
              <button
                type="button"
                onClick={() => onStatusChange("all")}
                className={quietButton}
              >
                Show everyone
              </button>
            }
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="border-b border-default/60">{toolbar}</div>

      {/* Column headings, wide screens only. Phones read the labels inline. */}
      <div
        aria-hidden
        className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_7rem_minmax(0,1fr)_9rem] gap-3 border-b border-default/60 bg-default-50/60 px-3.5 py-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-default-600 lg:grid"
      >
        <span>Name and address</span>
        <span>Joined from</span>
        <span>Status</span>
        <span>On the list since</span>
        <span className="text-right">Action</span>
      </div>

      <ul
        ref={listRef}
        aria-labelledby={headerId}
        aria-busy={isFetching || undefined}
        onKeyDown={move}
        className="divide-y divide-default/60"
      >
        <p id={headerId} className="sr-only">
          {total.toLocaleString()} {total === 1 ? "subscriber" : "subscribers"}
        </p>
        {rows.map((subscriber) => {
          const busy = removingEmail === subscriber.email;
          const deleting = deletingId === subscriber._id;
          const reason =
            subscriber.status === "bounced" ||
            subscriber.status === "complained"
              ? SUPPRESS_REASON[subscriber.status]
              : null;

          return (
            <li
              key={subscriber._id}
              data-subscriber-row="true"
              className="grid grid-cols-1 gap-x-3 gap-y-1.5 px-3.5 py-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_7rem_minmax(0,1fr)_9rem] lg:items-center"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {subscriber.name || "No name"}
                </p>
                <p className="truncate text-xs text-default-600">
                  {subscriber.email}
                </p>
              </div>

              <p className="min-w-0 truncate text-xs text-default-700">
                <span className="lg:hidden">Joined: </span>
                {SOURCE_LABEL[subscriber.source]}
              </p>

              <div className="min-w-0">
                <StatusPill status={subscriber.status} />
                {reason && (
                  <p className="mt-1 text-xs leading-relaxed text-default-600">
                    {reason}
                  </p>
                )}
                {subscriber.status === "unsubscribed" &&
                  subscriber.unsubscribedAt && (
                    <p className="mt-1 text-xs text-default-600">
                      Left {formatRelative(subscriber.unsubscribedAt)}
                    </p>
                  )}
              </div>

              <p className="text-xs tabular-nums text-default-700">
                <span className="lg:hidden">Since: </span>
                <time
                  dateTime={isoDate(subscriber.consentAt) ?? undefined}
                  title={formatExact(subscriber.consentAt)}
                >
                  {formatExact(subscriber.consentAt).split(",")[0]}
                </time>
              </p>

              <div className="flex items-center justify-end gap-1">
                {canRemove(subscriber.status) && (
                  <button
                    type="button"
                    onClick={() => onRemove(subscriber)}
                    disabled={busy || deleting}
                    aria-label={`Unsubscribe ${subscriber.email} from the newsletter`}
                    className={`inline-flex min-h-11 items-center justify-center rounded-[6px] px-2.5 text-xs font-medium text-default-700 transition-colors hover:bg-default-100 hover:text-foreground disabled:opacity-60 lg:min-h-8 ${focusRing}`}
                  >
                    {busy ? "Removing…" : "Unsubscribe"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onDeletePermanent(subscriber)}
                  disabled={busy || deleting}
                  aria-label={`Delete ${subscriber.email} permanently`}
                  title="Delete permanently"
                  className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] text-default-500 transition-colors hover:bg-danger/10 hover:text-danger disabled:opacity-60 lg:min-h-8 lg:min-w-8 ${focusRing}`}
                >
                  <FiTrash2 aria-hidden className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {isFetching && (
        <p className="sr-only" role="status">
          Refreshing subscribers
        </p>
      )}
    </div>
  );
};

export default SubscriberList;
