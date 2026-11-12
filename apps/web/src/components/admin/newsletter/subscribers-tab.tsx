"use client";

import {
  PAGE_SIZES,
  ListSelect,
  useDebouncedTerm,
} from "@/components/admin/list-controls";
import ConfirmDialog from "@/components/modules/admin/kit/confirm-dialog";
import AdminPagination from "@/components/modules/admin/kit/pagination";
import { focusRing } from "@/components/modules/admin/kit/tau";
import {
  useDeleteSubscriberPermanently,
  useExportSubscribers,
  useNewsletterSubscribers,
  useRemoveSubscriber,
} from "@/hooks/admin-newsletter";
import { listParam, useAdminListParams } from "@/hooks/use-admin-list-params";
import type { INewsletterSubscriber } from "@/services/admin/newsletter";
import { Spinner, useDisclosure } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FiDownload, FiPlus, FiSearch, FiX } from "react-icons/fi";

import AddSubscriberModal from "./add-subscriber-modal";
import { quietButton } from "./buttons";
import SubscriberList from "./subscriber-list";

const SUBSCRIBER_LIST = {
  status: listParam({
    values: ["all", "active", "unsubscribed", "bounced", "complained"] as const,
    default: "all",
    resetsPage: true,
  }),
  searchTerm: listParam({ default: "", resetsPage: true }),
  page: listParam({ default: 1 }),
  limit: listParam({
    default: PAGE_SIZES[0],
    allowed: PAGE_SIZES,
    resetsPage: true,
  }),
} as const;

/**
 * The list of people.
 *
 * Search, status, paging and page size are all server-side, so the screen
 * never holds more than one page. The counts on the tabs come back with the
 * rows and cover the whole list, not the page.
 *
 * All four live in the URL: a reload, a bookmark or a shared link returns the
 * same view, and changing a tab returns to the first page.
 */
const SubscribersTab = () => {
  const filters = useAdminListParams(SUBSCRIBER_LIST);
  const [query, setQuery] = useState(filters.values.searchTerm);
  const [addOpen, setAddOpen] = useState(false);
  const [removing, setRemoving] = useState<INewsletterSubscriber | null>(null);
  const [deleting, setDeleting] = useState<INewsletterSubscriber | null>(null);
  const confirm = useDisclosure();
  const confirmDelete = useDisclosure();

  // Settling a search reads the latest setter without restarting the timer.
  const setFiltersRef = useRef(filters.set);
  useEffect(() => {
    setFiltersRef.current = filters.set;
  }, [filters.set]);

  useDebouncedTerm(
    query,
    useCallback((searchTerm: string) => {
      setFiltersRef.current({ searchTerm });
    }, []),
  );

  const listQuery = useNewsletterSubscribers({
    page: filters.values.page,
    limit: filters.values.limit,
    status: filters.values.status,
    searchTerm: filters.values.searchTerm,
  });
  const remove = useRemoveSubscriber();
  const deletePermanent = useDeleteSubscriberPermanently();
  const exportList = useExportSubscribers();

  const meta = listQuery.meta;
  const totalPages = Math.max(meta?.totalPages ?? 1, 1);
  const total = meta?.total ?? 0;

  const askRemove = (subscriber: INewsletterSubscriber) => {
    setRemoving(subscriber);
    confirm.onOpen();
  };

  const closeConfirm = () => {
    if (remove.isPending) return;
    confirm.onClose();
    setRemoving(null);
  };

  const askDeletePermanent = (subscriber: INewsletterSubscriber) => {
    setDeleting(subscriber);
    confirmDelete.onOpen();
  };

  const closeConfirmDelete = () => {
    if (deletePermanent.isPending) return;
    confirmDelete.onClose();
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="relative flex min-w-0 flex-1 items-center sm:w-64 sm:flex-none">
            <FiSearch
              aria-hidden
              className="pointer-events-none absolute left-2.5 size-4 text-default-600"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name or address"
              aria-label="Search name or address"
              className={`h-11 w-full rounded-[6px] border border-default-200 bg-background pl-8 pr-8 text-sm text-foreground transition-colors placeholder:text-default-600 hover:border-default-300 focus:border-default-400 sm:h-9 ${focusRing}`}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className={`absolute right-0.5 inline-flex size-9 items-center justify-center rounded-[6px] text-default-600 hover:text-foreground ${focusRing}`}
              >
                <FiX aria-hidden className="size-4" />
              </button>
            ) : null}
          </div>

          <ListSelect
            label="Per page"
            hideLabel
            value={filters.values.limit}
            onChange={(value) => filters.set({ limit: Number(value) })}
            options={PAGE_SIZES.map((size) => ({
              value: size,
              label: `${size} per page`,
            }))}
          />

          {listQuery.isFetching && !listQuery.isLoading && (
            <Spinner size="sm" color="current" aria-hidden />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportList.mutate()}
            disabled={exportList.isPending || listQuery.counts.total === 0}
            aria-busy={exportList.isPending}
            className={quietButton}
          >
            <FiDownload aria-hidden className="size-4" />
            {exportList.isPending ? "Preparing…" : "Export CSV"}
          </button>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[6px] bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-500 sm:min-h-9 ${focusRing}`}
          >
            <FiPlus aria-hidden className="size-4" />
            Add subscriber
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-default/60 bg-content-1">
        <SubscriberList
          rows={listQuery.rows}
          total={total}
          isLoading={listQuery.isLoading}
          isFetching={listQuery.isFetching}
          failed={listQuery.isError}
          failedMessage={listQuery.error?.message}
          onRetry={() => listQuery.refetch()}
          status={filters.values.status}
          onStatusChange={(status) => filters.set({ status })}
          counts={listQuery.counts}
          searchTerm={filters.values.searchTerm}
          onClearSearch={() => setQuery("")}
          removingEmail={remove.isPending ? remove.variables : undefined}
          deletingId={
            deletePermanent.isPending ? deletePermanent.variables : undefined
          }
          onRemove={askRemove}
          onDeletePermanent={askDeletePermanent}
        />

        {!listQuery.isLoading &&
          !listQuery.isError &&
          listQuery.rows.length > 0 && (
            <AdminPagination
              page={meta?.page ?? filters.values.page}
              totalPages={totalPages}
              total={total}
              pageSize={meta?.limit ?? filters.values.limit}
              onPageChange={(page) => filters.set({ page: Math.max(1, page) })}
            />
          )}
      </div>

      <p className="text-xs leading-relaxed text-default-600">
        A bounced or reported address stays off the list for good, here and on
        the site, because mailing it again damages the domain the newsletter is
        sent from. The export carries the name, address, status and dates, and
        nothing that would let someone act on a subscriber&apos;s behalf.
      </p>

      <AddSubscriberModal isOpen={addOpen} onClose={() => setAddOpen(false)} />

      <ConfirmDialog
        isOpen={confirm.isOpen}
        onOpenChange={(open) => {
          if (!open) closeConfirm();
        }}
        title={
          removing
            ? `Unsubscribe ${removing.email}?`
            : "Unsubscribe this address?"
        }
        description="They stop getting campaigns, and the next send will not reach them. This is the same as them pressing unsubscribe."
        confirmLabel="Unsubscribe"
        tone="danger"
        isPending={remove.isPending}
        onConfirm={() => {
          if (!removing) return;
          remove.mutate(removing.email, {
            onSuccess: () => {
              confirm.onClose();
              setRemoving(null);
            },
          });
        }}
      />

      <ConfirmDialog
        isOpen={confirmDelete.isOpen}
        onOpenChange={(open) => {
          if (!open) closeConfirmDelete();
        }}
        title={
          deleting
            ? `Delete ${deleting.email} permanently?`
            : "Delete this subscriber permanently?"
        }
        description="This permanently erases the subscriber record from the database and cannot be undone."
        confirmLabel="Delete permanently"
        tone="danger"
        isPending={deletePermanent.isPending}
        onConfirm={() => {
          if (!deleting) return;
          deletePermanent.mutate(deleting._id, {
            onSuccess: () => {
              confirmDelete.onClose();
              setDeleting(null);
            },
          });
        }}
      />
    </div>
  );
};

export default SubscribersTab;
