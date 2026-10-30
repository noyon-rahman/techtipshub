"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

import {
  listDefaults,
  listHref,
  listParam,
  mergeListParams,
  parseListParams,
  resetListParams,
  type IListParam,
  type TListParamInput,
  type TListParamKind,
  type TListSchema,
  type TListValues,
  type TMessageFilter,
} from "@/lib/admin-list-params";

/**
 * An admin list's filters, read from and written to the URL.
 *
 * `useSearchParams` is client only: during a prerender it hands rendering over
 * to the nearest `<Suspense>`, and a static page that calls it without one
 * fails the production build. Wrap the screen body in `<Suspense>`, as the
 * example does.
 *
 * ```tsx
 * // /admin/messages, as a client page. The schema sits at module scope, so it
 * // is the same object on every render. Values are inline and `as const`.
 * "use client";
 *
 * import {
 *   ListSelect,
 *   PAGE_SIZE_OPTIONS,
 *   PAGE_SIZES,
 *   useDebouncedTerm,
 * } from "@/components/admin/list-controls";
 * import AdminPagination from "@/components/modules/admin/kit/pagination";
 * import AdminPageSpinner from "@/components/shared/admin-sidebar/admin-page-spinner";
 * import { useContactMessages } from "@/hooks/admin-messages";
 * import {
 *   listParam,
 *   useAdminListParams,
 *   type TListSchema,
 *   type TMessageFilter,
 * } from "@/hooks/use-admin-list-params";
 * import { Suspense, useCallback, useEffect, useRef, useState } from "react";
 *
 * // `status` carries the schema's union, so `set({ status })` takes no cast.
 * const isMessageFilter = (
 *   status: string,
 * ): status is Exclude<TMessageFilter, "none"> =>
 *   MESSAGE_LIST.status.kind.type === "enum" &&
 *   (MESSAGE_LIST.status.kind.values as readonly string[]).includes(status);
 *
 * const MESSAGE_LIST = {
 *   status: listParam({
 *     values: ["all", "new", "read", "archived"] as const,
 *     default: "all",
 *     resetsPage: true,
 *   }),
 *   searchTerm: listParam({ default: "", resetsPage: true }),
 *   page: listParam({ default: 1 }),
 *   limit: listParam({
 *     default: PAGE_SIZES[0],
 *     allowed: PAGE_SIZES,
 *     resetsPage: true,
 *   }),
 * } satisfies TListSchema;
 *
 * function MessagesBody() {
 *   const filters = useAdminListParams(MESSAGE_LIST);
 *   const listQuery = useContactMessages({
 *     page: filters.values.page,
 *     limit: filters.values.limit,
 *     status: filters.values.status,
 *     searchTerm: filters.values.searchTerm,
 *   });
 *
 *   // The debounce stays here; the hook takes the settled term. Refing the
 *   // setter (not the whole hook) keeps the timer from restarting.
 *   const [query, setQuery] = useState(filters.values.searchTerm);
 *   const filtersRef = useRef(filters.set);
 *   useEffect(() => {
 *     filtersRef.current = filters.set;
 *   }, [filters.set]);
 *   useDebouncedTerm(
 *     query,
 *     useCallback((searchTerm: string) => {
 *       filtersRef.current({ searchTerm });
 *     }, []),
 *   );
 *
 *   return (
 *     <>
 *       <input
 *         value={query}
 *         onChange={(event) => setQuery(event.target.value)}
 *         placeholder="Search messages"
 *       />
 *       <ListSelect
 *         label="Status"
 *         value={filters.values.status}
 *         options={["all", "new", "read", "archived"].map((status) => ({
 *           value: status,
 *           label: status,
 *         }))}
 *         onChange={(status) => {
 *           if (isMessageFilter(status)) filters.set({ status });
 *         }}
 *       />
 *       <ListSelect
 *         label="Per page"
 *         value={filters.values.limit}
 *         options={PAGE_SIZE_OPTIONS}
 *         onChange={(limit) => filters.set({ limit: Number(limit) })}
 *       />
 *       <AdminPagination
 *         page={filters.values.page}
 *         totalPages={listQuery.meta?.totalPages ?? 1}
 *         onPageChange={(page) => filters.set({ page })}
 *       />
 *       <button type="button" onClick={filters.reset}>
 *         Clear filters
 *       </button>
 *     </>
 *   );
 * }
 *
 * export default function MessagesPage() {
 *   return (
 *     <Suspense fallback={<AdminPageSpinner label="Loading the inbox" />}>
 *       <MessagesBody />
 *     </Suspense>
 *   );
 * }
 * ```
 *
 * A header above the body or outside the boundary calls the hook again with the
 * same schema rather than taking the values as a prop. `useSearchParams` gives
 * both the same URL, so the tab name in the header and the request cannot
 * disagree, and neither has to be lifted into a context.
 *
 * Setters use `router.replace` inside a transition: a tab or a page click is a
 * view change, not a place to return to, so it must not fill the browser's
 * history. Picking eleven pages in a row would otherwise cost eleven presses
 * of Back, and the entry the reader came from would sit behind all of them.
 * The URL stays the source of truth for a fresh load, a bookmark and a shared
 * link, so there is no push variant. The consequence to know: Back leaves the
 * screen rather than undoing one tab click.
 */
export const useAdminListParams = <S extends TListSchema>(schema: S) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const read = useMemo(
    () => parseListParams(schema, searchParams),
    [schema, searchParams],
  );

  const go = useCallback(
    (params: URLSearchParams) => {
      startTransition(() => {
        router.replace(listHref(pathname, params), { scroll: false });
      });
    },
    [router, pathname],
  );

  const set = useCallback(
    (update: Partial<TListValues<S>>) => {
      go(mergeListParams(schema, new URLSearchParams(searchParams), update));
    },
    [go, schema, searchParams],
  );

  const reset = useCallback(() => {
    go(resetListParams(schema, new URLSearchParams(searchParams)));
  }, [go, schema, searchParams]);

  return { values: read, set, reset, isPending };
};

/**
 * The schema helpers and the defaults, re-exported so a screen imports them
 * from one place. Both are pure and stay usable outside a component.
 */
export { listDefaults, listParam };
export type {
  IListParam,
  TListParamInput,
  TListParamKind,
  TListSchema,
  TListValues,
  TMessageFilter,
};
