"use client";

import { formatDate, initialsOf, plural } from "@/components/admin/format";
import {
  ListSelect,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZES,
  quietButton,
  useDebouncedTerm,
} from "@/components/admin/list-controls";
import ConfirmDialog from "@/components/modules/admin/kit/confirm-dialog";
import DataTable from "@/components/modules/admin/kit/data-table";
import DataToolbar from "@/components/modules/admin/kit/data-toolbar";
import EmptyState from "@/components/modules/admin/kit/empty-state";
import ListFooter from "@/components/modules/admin/kit/list-footer";
import ListFrame from "@/components/modules/admin/kit/list-frame";
import { focusRing } from "@/components/modules/admin/kit/tau";
import {
  useRestoreBlog,
  useRestoreUser,
  useTrashedBlogs,
  useTrashedUsers,
} from "@/hooks/admin-trash";
import {
  useDeleteAdminBlogPermanently,
  useTrashCounts,
} from "@/hooks/admin-blogs";
import { listParam, useAdminListParams } from "@/hooks/use-admin-list-params";
import type { IUser, ITrashedUser } from "@/types";
import UserAvatar from "@/components/ui/user-avatar";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MdOutlineArticle } from "react-icons/md";
import { PiUsers } from "react-icons/pi";
import { RiArrowGoBackLine, RiDeleteBinLine } from "react-icons/ri";

/**
 * Both tabs page the same row count, so one `page` serves whichever tab is
 * open and a tab switch starts that tab at its first page.
 */
const TRASH_LIST = {
  tab: listParam({
    values: ["articles", "members"] as const,
    default: "articles",
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

type Tab = "articles" | "members";

interface IRestored {
  name: string;
  href?: string;
  what: "article" | "account";
}

/** A restore answers with the restored document, sometimes wrapped. */
const readRestored = <T,>(response: unknown): T | undefined => {
  const payload = response as { success?: boolean; data?: unknown } | undefined;
  if (!payload || payload.success === false || !payload.data) return undefined;

  const data = payload.data as T | { blog?: T; user?: T };
  if (typeof data === "object" && data !== null) {
    const wrapped = data as { blog?: T; user?: T };
    if (wrapped.blog) return wrapped.blog;
    if (wrapped.user) return wrapped.user;
  }

  return data as T;
};

const restoreButton = `inline-flex min-h-11 items-center gap-1.5 rounded-[6px] border border-default-200 px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-default-100 disabled:opacity-50 sm:min-h-9 ${focusRing}`;

const dangerButton = `inline-flex min-h-11 items-center gap-1.5 rounded-[6px] border border-danger/40 px-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50 sm:min-h-9 ${focusRing}`;

const linkClass = `rounded font-medium text-primary-accessible underline-offset-4 hover:underline ${focusRing}`;

/** The deleted row as the trash endpoints send it; no body, so no content. */
interface ITrashedArticle {
  _id: string;
  title: string;
  slug: string;
  author?: Pick<IUser, "fullName" | "username">;
  category?: { name?: string };
  updatedAt?: string;
}

/**
 * The trash. Both lists are server-paged and both search the whole trash, not
 * the page on screen, so the tab badges, the footer total and the pager always
 * describe every match.
 *
 * A restore leaves a row behind so the reader can open what came back. The
 * API stores no deletion time, so the date column is the last change.
 *
 * The tab, search, page and page size are in the URL, so a reload or a shared
 * link lands back on the same list.
 */
const TrashManager = () => {
  const filters = useAdminListParams(TRASH_LIST);
  const { tab, page, limit, searchTerm } = filters.values;
  const [query, setQuery] = useState(searchTerm);
  const [restored, setRestored] = useState<IRestored | null>(null);
  const [removed, setRemoved] = useState<string | null>(null);
  const panelId = useId();

  // Settling a search reads the latest setter without restarting the timer.
  const filtersRef = useRef(filters.set);
  useEffect(() => {
    filtersRef.current = filters.set;
  }, [filters.set]);
  useDebouncedTerm(
    query,
    useCallback((term: string) => {
      filtersRef.current({ searchTerm: term });
    }, []),
  );

  const blogsQuery = useTrashedBlogs({ page, limit, searchTerm });
  const usersQuery = useTrashedUsers({ page, limit, searchTerm });
  const countsQuery = useTrashCounts();

  const { mutate: restoreBlog, isPending: isRestoringBlog } = useRestoreBlog();
  const { mutate: restoreUser, isPending: isRestoringUser } = useRestoreUser();
  const { mutate: deleteForever, isPending: isDeletingForever } =
    useDeleteAdminBlogPermanently();

  const articleCount = countsQuery.data?.blogs;
  const memberCount = countsQuery.data?.users;

  const tabs = [
    { key: "articles", label: "Articles", count: articleCount },
    { key: "members", label: "Members", count: memberCount },
  ];

  const changeTab = (next: Tab) => {
    setQuery("");
    filters.set({ tab: next, searchTerm: "" });
    void countsQuery.refetch();
  };

  // A restore or a delete can empty the last page of the open tab.
  const stepBackIfEmpty = (shown: number) => {
    if (page > 1 && shown <= 1) filters.set({ page: page - 1 });
  };

  const onRestoreBlog = (blog: ITrashedArticle) => {
    restoreBlog(blog._id, {
      onSuccess: (response) => {
        const result = readRestored<{ title?: string; slug?: string }>(
          response,
        );
        setRemoved(null);
        setRestored({
          name: result?.title || blog.title || "The article",
          href: result?.slug ? `/blogs/${result.slug}` : undefined,
          what: "article",
        });
        stepBackIfEmpty(blogsQuery.rows.length);
      },
    });
  };

  const onDeleteForever = (blog: ITrashedArticle) => {
    deleteForever({
      id: blog._id,
      onDeleted: () => {
        setRestored(null);
        setRemoved(blog.title || "The article");
        stepBackIfEmpty(blogsQuery.rows.length);
      },
    });
  };

  const onRestoreUser = (user: ITrashedUser) => {
    restoreUser(user._id, {
      onSuccess: (response) => {
        const result = readRestored<{ fullName?: string }>(response);
        setRestored({
          name: result?.fullName || user.fullName || "The member",
          href: `/admin/manage-users/${user._id}`,
          what: "account",
        });
        stepBackIfEmpty(usersQuery.rows.length);
      },
    });
  };

  const articlesBody = () => {
    if (blogsQuery.isError) {
      return (
        <EmptyState
          variant="inline"
          icon={<MdOutlineArticle className="size-5" />}
          title="Removed articles could not be loaded"
          description={
            blogsQuery.error?.message ||
            "The request failed. Check that the API is running, then try again."
          }
          action={
            <button
              type="button"
              onClick={() => void blogsQuery.refetch()}
              className={quietButton}
            >
              Try again
            </button>
          }
        />
      );
    }

    const meta = blogsQuery.meta;
    const totalPages = Math.max(meta?.totalPages ?? 1, 1);
    const rows = blogsQuery.rows as ITrashedArticle[];

    return (
      <DataTable
        columns={[
          { key: "title", header: "Article", className: "min-w-[16rem]" },
          { key: "author", header: "Author" },
          { key: "category", header: "Category" },
          { key: "changed", header: "Last changed" },
          { key: "actions", header: "Actions", align: "right" },
        ]}
        rows={rows}
        getRowKey={(row) => row._id}
        isLoading={blogsQuery.isLoading}
        skeletonRows={Math.min(limit, 10)}
        minWidth="48rem"
        caption="Removed articles, most recently changed first"
        emptyState={
          searchTerm ? (
            <EmptyState
              variant="inline"
              icon={<MdOutlineArticle className="size-5" />}
              title="No removed article matches this search"
              description={`No article in the trash has "${searchTerm}" in its title or slug. Clear the search to see every removed article.`}
              action={
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={quietButton}
                >
                  Clear the search
                </button>
              }
            />
          ) : (
            <EmptyState
              variant="inline"
              icon={<MdOutlineArticle className="size-5" />}
              title="No articles in the trash"
              description="Articles an author or an admin removes land here and stay restorable."
              action={
                <Link href="/admin/manage-blogs" className={linkClass}>
                  Open article management
                </Link>
              }
            />
          )
        }
        renderCell={(blog, columnKey) => {
          switch (columnKey) {
            case "title":
              return (
                <span className="line-clamp-2 max-w-[22rem] font-medium leading-snug">
                  {blog.title || "Untitled article"}
                </span>
              );

            case "author":
              return (
                <span className="block max-w-[12rem] truncate text-default-600">
                  {blog.author?.fullName || "Removed author"}
                </span>
              );

            case "category":
              return (
                <span className="whitespace-nowrap text-default-600">
                  {blog.category?.name || "No category"}
                </span>
              );

            case "changed":
              return (
                <span className="whitespace-nowrap text-xs tabular-nums text-default-600">
                  {formatDate(blog.updatedAt) || "Not recorded"}
                </span>
              );

            case "actions":
              return (
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <ConfirmDialog
                    trigger={
                      <button
                        type="button"
                        className={restoreButton}
                        aria-label={`Restore ${blog.title || "this article"}`}
                      >
                        <RiArrowGoBackLine aria-hidden className="size-4" />
                        Restore
                      </button>
                    }
                    title="Restore this article?"
                    description="It returns to the feed and to its author's profile. Its comments, views and votes were removed with it, so it starts with none."
                    confirmLabel="Restore article"
                    isPending={isRestoringBlog}
                    onConfirm={() => onRestoreBlog(blog)}
                  />

                  <ConfirmDialog
                    trigger={
                      <button
                        type="button"
                        className={dangerButton}
                        aria-label={`Delete ${
                          blog.title || "this article"
                        } permanently`}
                      >
                        <RiDeleteBinLine aria-hidden className="size-4" />
                        Delete permanently
                      </button>
                    }
                    title={`Delete "${
                      blog.title || "this article"
                    }" permanently?`}
                    description="This erases the article and its comments, views and votes for good. It cannot be restored, and its address can be used by another article."
                    confirmLabel="Delete permanently"
                    tone="danger"
                    isPending={isDeletingForever}
                    onConfirm={() => onDeleteForever(blog)}
                  />
                </div>
              );

            default:
              return null;
          }
        }}
        footer={
          <ListFooter
            total={meta?.total}
            shown={rows.length}
            noun="removed article"
            page={meta?.page ?? page}
            totalPages={totalPages}
            pageSize={meta?.limit ?? limit}
            onPageChange={(next) => filters.set({ page: next })}
            isLoading={blogsQuery.isLoading && !meta}
            isError={blogsQuery.isError}
            context={searchTerm ? `, matching "${searchTerm}"` : null}
          />
        }
      />
    );
  };

  const membersBody = () => {
    if (usersQuery.isError) {
      return (
        <EmptyState
          variant="inline"
          icon={<PiUsers className="size-5" />}
          title="Removed members could not be loaded"
          description={
            usersQuery.error?.message ||
            "The request failed. Check that the API is running, then try again."
          }
          action={
            <button
              type="button"
              onClick={() => void usersQuery.refetch()}
              className={quietButton}
            >
              Try again
            </button>
          }
        />
      );
    }

    const meta = usersQuery.meta;
    const totalPages = Math.max(meta?.totalPages ?? 1, 1);

    return (
      <DataTable
        columns={[
          { key: "member", header: "Member", className: "min-w-[14rem]" },
          { key: "email", header: "Email" },
          { key: "role", header: "Role at deletion" },
          { key: "changed", header: "Last changed" },
          { key: "actions", header: "Actions", align: "right" },
        ]}
        rows={usersQuery.rows}
        getRowKey={(row) => row._id}
        isLoading={usersQuery.isLoading}
        skeletonRows={Math.min(limit, 10)}
        minWidth="52rem"
        caption="Deleted member accounts, most recently changed first"
        emptyState={
          <EmptyState
            variant="inline"
            icon={<PiUsers className="size-5" />}
            title={
              searchTerm
                ? "No removed member matches this search"
                : "No members in the trash"
            }
            description={
              searchTerm
                ? `No account in the trash has "${searchTerm}" in its name, username or email. Clear the search to see every removed member.`
                : "Deleted accounts land here. Restoring one brings the login back without the articles and comments that went with it."
            }
            action={
              searchTerm ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className={quietButton}
                >
                  Clear the search
                </button>
              ) : (
                <Link href="/admin/manage-users" className={linkClass}>
                  Open member management
                </Link>
              )
            }
          />
        }
        renderCell={(user, columnKey) => {
          switch (columnKey) {
            case "member":
              return (
                <div className="flex items-center gap-2.5">
                  <UserAvatar
                    src={user.profilePicture || undefined}
                    name={initialsOf(user.fullName)}
                    className="size-8 shrink-0"
                    classNames={{ name: "text-xs" }}
                  />
                  <span className="min-w-0">
                    <span className="block max-w-[14rem] truncate font-medium">
                      {user.fullName || "Unnamed member"}
                    </span>
                    {user.username && (
                      <span className="block max-w-[14rem] truncate text-xs text-default-600">
                        @{user.username}
                      </span>
                    )}
                  </span>
                </div>
              );

            case "email":
              return (
                <span className="block max-w-[16rem] truncate text-default-600">
                  {user.email || "No email recorded"}
                </span>
              );

            case "role":
              return (
                <span className="whitespace-nowrap text-default-600">
                  {user.role === "Admin" ? "Admin" : "Member"}
                </span>
              );

            case "changed":
              return (
                <span className="whitespace-nowrap text-xs tabular-nums text-default-600">
                  {formatDate(user.updatedAt) || "Not recorded"}
                </span>
              );

            case "actions":
              return (
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      className={restoreButton}
                      aria-label={`Restore ${user.fullName || "this member"}`}
                    >
                      <RiArrowGoBackLine aria-hidden className="size-4" />
                      Restore
                    </button>
                  }
                  title="Restore this member?"
                  description="The login and profile come back. The articles, comments and votes removed with the account do not, so it returns with an empty history."
                  confirmLabel="Restore account"
                  isPending={isRestoringUser}
                  onConfirm={() => onRestoreUser(user)}
                />
              );

            default:
              return null;
          }
        }}
        footer={
          <ListFooter
            total={meta?.total}
            shown={usersQuery.rows.length}
            noun="deleted account"
            page={meta?.page ?? page}
            totalPages={totalPages}
            pageSize={meta?.limit ?? limit}
            onPageChange={(next) => filters.set({ page: next })}
            isLoading={usersQuery.isLoading && !meta}
            isError={usersQuery.isError}
            context={searchTerm ? `, matching "${searchTerm}"` : null}
          />
        }
      />
    );
  };

  return (
    <div className="space-y-4">
      <ListFrame label="Removed articles and accounts">
        <DataToolbar
          filters={tabs}
          activeFilter={tab}
          onFilterChange={(key) =>
            changeTab(key === "members" ? "members" : "articles")
          }
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder={
            tab === "articles" ? "Title or slug" : "Name, username or email"
          }
          right={
            <ListSelect
              label="Per page"
              hideLabel
              value={limit}
              onChange={(value) =>
                filters.set({ limit: Number(value) || PAGE_SIZES[0] })
              }
              options={PAGE_SIZE_OPTIONS}
            />
          }
        />

        <div
          id={`${panelId}-panel`}
          role="tabpanel"
          aria-label={
            tab === "articles" ? "Removed articles" : "Removed members"
          }
        >
          {tab === "articles" ? articlesBody() : membersBody()}
        </div>
      </ListFrame>

      <div aria-live="polite" aria-atomic="true">
        {restored ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-success/30 bg-success/5 px-4 py-3 text-sm">
            <p>
              <span className="font-semibold">{restored.name}</span> is back as
              a live {restored.what}.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {restored.href ? (
                <Link href={restored.href} className={linkClass}>
                  {restored.what === "article"
                    ? "Open the article"
                    : "Open the member"}
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => setRestored(null)}
                className={`inline-flex min-h-11 items-center rounded-sm text-xs text-default-600 underline-offset-4 hover:underline sm:min-h-9 ${focusRing}`}
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : removed ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-danger/30 bg-danger/5 px-4 py-3 text-sm">
            <p>
              <span className="font-semibold">{removed}</span> was deleted
              permanently.
            </p>
            <button
              type="button"
              onClick={() => setRemoved(null)}
              className={`inline-flex min-h-11 items-center rounded-sm text-xs text-default-600 underline-offset-4 hover:underline sm:min-h-9 ${focusRing}`}
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </div>

      <p className="text-xs leading-relaxed text-default-600">
        The API stores no deletion time, so the date column is when each record
        last changed. Both tabs search the whole trash, so a search finds a
        record on any page.{" "}
        {articleCount !== undefined && memberCount !== undefined ? (
          <span className="tabular-nums">
            {plural(articleCount ?? 0, "article")} and{" "}
            {plural(memberCount, "account")} in total.
          </span>
        ) : null}
      </p>
    </div>
  );
};

export default TrashManager;
