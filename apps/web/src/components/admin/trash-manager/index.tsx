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
import SelectionBar from "@/components/modules/admin/kit/selection-bar";
import { focusRing } from "@/components/modules/admin/kit/tau";
import useRowSelection from "@/components/modules/admin/kit/use-row-selection";
import {
  useDeleteUserPermanently,
  useDeleteUsersPermanentlyInBulk,
  useRestoreBlog,
  useRestoreUser,
  useTrashedBlogs,
  useTrashedUsers,
} from "@/hooks/admin-trash";
import {
  useDeleteAdminBlogPermanently,
  useDeleteAdminBlogsPermanentlyInBulk,
  useTrashCounts,
} from "@/hooks/admin-blogs";
import {
  useDeleteCategoryPermanently,
  useRestoreCategory,
  useTrashedCategories,
} from "@/hooks/admin-categories";
import {
  useDeleteCommentsPermanently,
  useTrashedComments,
} from "@/hooks/admin-comments";
import { listParam, useAdminListParams } from "@/hooks/use-admin-list-params";
import type { IUser, ITrashedUser } from "@/types";
import UserAvatar from "@/components/ui/user-avatar";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MdOutlineArticle } from "react-icons/md";
import { PiChatCircle, PiUsers } from "react-icons/pi";
import {
  RiArrowGoBackLine,
  RiDeleteBinLine,
  RiFolder3Line,
} from "react-icons/ri";

/**
 * Both tabs page the same row count, so one `page` serves whichever tab is
 * open and a tab switch starts that tab at its first page.
 */
const TRASH_LIST = {
  tab: listParam({
    values: ["articles", "members", "categories", "comments"] as const,
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

type Tab = "articles" | "members" | "categories" | "comments";

interface IRestored {
  name: string;
  href?: string;
  what: "article" | "account" | "category";
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
 * The one bulk action in the trash: erase everything picked.
 *
 * There is no bulk restore on purpose. Each row's restore check is its own
 * (a category's name may be taken, an article's address may be reused), and a
 * partial answer would leave the admin guessing.
 */
const BulkDeleteForever = ({
  count,
  noun,
  pluralNoun = `${noun}s`,
  isPending,
  onConfirm,
}: {
  count: number;
  noun: string;
  pluralNoun?: string;
  isPending: boolean;
  onConfirm: () => void;
}) => (
  <ConfirmDialog
    trigger={
      <button type="button" className={dangerButton}>
        <RiDeleteBinLine aria-hidden className="size-4" />
        Delete permanently
      </button>
    }
    title={`Delete ${count} ${count === 1 ? noun : pluralNoun} permanently?`}
    description="This erases the picked records for good. Nothing is kept for a restore, and the addresses they held can be used again."
    confirmLabel="Delete permanently"
    tone="danger"
    isPending={isPending}
    onConfirm={onConfirm}
  />
);

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
  const categoriesQuery = useTrashedCategories();
  const commentsQuery = useTrashedComments();

  // The category and comment trash lists are not paged: the set is small and
  // one request answers both the table and its count.
  const needle = searchTerm.trim().toLowerCase();
  const categoryRows = needle
    ? categoriesQuery.rows.filter((row) =>
        [row.name, row.description ?? ""].some((value) =>
          value.toLowerCase().includes(needle),
        ),
      )
    : categoriesQuery.rows;
  const commentRows = needle
    ? commentsQuery.rows.filter((row) =>
        [row.content, row.post?.title ?? "", row.user?.fullName ?? ""].some(
          (value) => value.toLowerCase().includes(needle),
        ),
      )
    : commentsQuery.rows;

  // One selection per tab: picking in one list must not arm the action in
  // another.
  const blogSelection = useRowSelection({
    rows: blogsQuery.rows,
    getKey: (row) => row._id,
    resetWith: `${page}:${limit}:${searchTerm}`,
    selectAllLabel: "Select every removed article on this page",
  });
  const userSelection = useRowSelection({
    rows: usersQuery.rows,
    getKey: (row) => row._id,
    resetWith: `${page}:${limit}:${searchTerm}`,
    selectAllLabel: "Select every removed member on this page",
  });
  const categorySelection = useRowSelection({
    rows: categoryRows,
    getKey: (row) => row._id,
    resetWith: searchTerm,
    selectAllLabel: "Select every removed category",
  });
  const commentSelection = useRowSelection({
    rows: commentRows,
    getKey: (row) => row._id,
    resetWith: searchTerm,
    selectAllLabel: "Select every removed comment",
  });

  const { mutate: restoreBlog, isPending: isRestoringBlog } = useRestoreBlog();
  const { mutate: restoreUser, isPending: isRestoringUser } = useRestoreUser();
  const { mutate: deleteUserForever, isPending: isDeletingUserForever } =
    useDeleteUserPermanently();
  const { mutate: deleteForever, isPending: isDeletingForever } =
    useDeleteAdminBlogPermanently();
  const { mutate: deleteBlogsInBulkForever, isPending: isDeletingBlogsInBulk } =
    useDeleteAdminBlogsPermanentlyInBulk();
  const { mutate: deleteUsersInBulkForever, isPending: isDeletingUsersInBulk } =
    useDeleteUsersPermanentlyInBulk();
  const {
    mutate: deleteCategoriesInBulkForever,
    isPending: isDeletingCategoriesForever,
  } = useDeleteCategoryPermanently();
  const {
    mutate: deleteCategoryForever,
    isPending: isDeletingCategoryForever,
  } = useDeleteCategoryPermanently();
  const { mutate: restoreCategory, isPending: isRestoringCategory } =
    useRestoreCategory();
  const {
    mutate: deleteCommentsInBulkForever,
    isPending: isDeletingCommentsForever,
  } = useDeleteCommentsPermanently();
  const { mutate: deleteCommentForever, isPending: isDeletingCommentForever } =
    useDeleteCommentsPermanently();

  const articleCount = countsQuery.data?.blogs;
  const memberCount = countsQuery.data?.users;
  const categoryCount = countsQuery.data?.categories;
  const commentCount = countsQuery.data?.comments;

  const tabs = [
    { key: "articles", label: "Articles", count: articleCount },
    { key: "members", label: "Members", count: memberCount },
    { key: "categories", label: "Categories", count: categoryCount },
    { key: "comments", label: "Comments", count: commentCount },
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

  const onDeleteUserForever = (user: ITrashedUser) => {
    deleteUserForever(user._id, {
      onSuccess: (response) => {
        if (response?.success === false) return;
        setRestored(null);
        setRemoved(user.fullName || "The member");
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
      <>
        <SelectionBar
          count={blogSelection.count}
          noun="article"
          onClear={blogSelection.clear}
        >
          <BulkDeleteForever
            count={blogSelection.count}
            noun="article"
            isPending={isDeletingBlogsInBulk}
            onConfirm={() =>
              deleteBlogsInBulkForever(blogSelection.keys, {
                onSuccess: () => blogSelection.clear(),
              })
            }
          />
        </SelectionBar>

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
          minWidth="52rem"
          caption="Removed articles, most recently changed first"
          selection={blogSelection}
          rowLabel={(blog) => `Select ${blog.title || "this article"}`}
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
      </>
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
      <>
        <SelectionBar
          count={userSelection.count}
          noun="member"
          onClear={userSelection.clear}
        >
          <BulkDeleteForever
            count={userSelection.count}
            noun="member"
            isPending={isDeletingUsersInBulk}
            onConfirm={() =>
              deleteUsersInBulkForever(userSelection.keys, {
                onSuccess: () => userSelection.clear(),
              })
            }
          />
        </SelectionBar>

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
          minWidth="56rem"
          caption="Deleted member accounts, most recently changed first"
          selection={userSelection}
          rowLabel={(user) => `Select ${user.fullName || "this member"}`}
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
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
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

                    <ConfirmDialog
                      trigger={
                        <button
                          type="button"
                          className={dangerButton}
                          aria-label={`Delete ${
                            user.fullName || "this member"
                          } permanently`}
                        >
                          <RiDeleteBinLine aria-hidden className="size-4" />
                          Delete permanently
                        </button>
                      }
                      title={`Delete "${
                        user.fullName || "this member"
                      }" permanently?`}
                      description="This erases the account for good, and the name, handle and address can be used by someone else. The address stops answering, and nothing here can bring the member back."
                      confirmLabel="Delete permanently"
                      tone="danger"
                      isPending={isDeletingUserForever}
                      onConfirm={() => onDeleteUserForever(user)}
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
      </>
    );
  };

  const categoriesBody = () => {
    if (categoriesQuery.isError) {
      return (
        <EmptyState
          variant="inline"
          icon={<RiFolder3Line className="size-5" />}
          title="Removed categories could not be loaded"
          description={
            categoriesQuery.error?.message ||
            "The request failed. Check that the API is running, then try again."
          }
          action={
            <button
              type="button"
              onClick={() => void categoriesQuery.refetch()}
              className={quietButton}
            >
              Try again
            </button>
          }
        />
      );
    }

    return (
      <>
        <SelectionBar
          count={categorySelection.count}
          noun="category"
          pluralNoun="categories"
          onClear={categorySelection.clear}
        >
          <BulkDeleteForever
            count={categorySelection.count}
            noun="category"
            pluralNoun="categories"
            isPending={isDeletingCategoriesForever}
            onConfirm={() =>
              deleteCategoriesInBulkForever(categorySelection.keys, {
                onSuccess: () => categorySelection.clear(),
              })
            }
          />
        </SelectionBar>

        <DataTable
          columns={[
            { key: "name", header: "Category", className: "min-w-[16rem]" },
            { key: "count", header: "Articles", align: "right" },
            { key: "changed", header: "Last changed" },
            { key: "actions", header: "Actions", align: "right" },
          ]}
          rows={categoryRows}
          getRowKey={(row) => row._id}
          isLoading={categoriesQuery.isLoading}
          minWidth="44rem"
          caption="Removed categories, most recently changed first"
          selection={categorySelection}
          rowLabel={(row) => `Select ${row.name}`}
          emptyState={
            <EmptyState
              variant="inline"
              icon={<RiFolder3Line className="size-5" />}
              title={
                needle
                  ? "No removed category matches this search"
                  : "No categories in the trash"
              }
              description={
                needle
                  ? `No category in the trash has "${searchTerm}" in its name or description. Clear the search to see every removed category.`
                  : "Categories removed from the list wait here. Restoring one puts its name back in the feed filter and the composer."
              }
              action={
                needle ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className={quietButton}
                  >
                    Clear the search
                  </button>
                ) : (
                  <Link href="/admin/categories" className={linkClass}>
                    Open categories
                  </Link>
                )
              }
            />
          }
          renderCell={(category, columnKey) => {
            switch (columnKey) {
              case "name":
                return (
                  <span className="block max-w-[22rem]">
                    <span className="block truncate font-medium">
                      {category.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-default-600">
                      {category.description || "No description"}
                    </span>
                  </span>
                );

              case "count":
                return (
                  <span className="tabular-nums text-default-600">
                    {category.blogCount ?? 0}
                  </span>
                );

              case "changed":
                return (
                  <span className="whitespace-nowrap text-xs tabular-nums text-default-600">
                    {formatDate(category.createdAt) || "Not recorded"}
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
                          aria-label={`Restore ${category.name}`}
                        >
                          <RiArrowGoBackLine aria-hidden className="size-4" />
                          Restore
                        </button>
                      }
                      title={`Restore ${category.name}?`}
                      description="It returns to the feed filter and the category picker. Another category must not have taken the name in the meantime."
                      confirmLabel="Restore category"
                      isPending={isRestoringCategory}
                      onConfirm={() =>
                        restoreCategory(category._id, {
                          onSuccess: (response) => {
                            const result = readRestored<{ name?: string }>(
                              response,
                            );
                            setRemoved(null);
                            setRestored({
                              name: result?.name || category.name,
                              href: "/admin/categories",
                              what: "category",
                            });
                          },
                        })
                      }
                    />

                    <ConfirmDialog
                      trigger={
                        <button
                          type="button"
                          className={dangerButton}
                          aria-label={`Delete ${category.name} permanently`}
                        >
                          <RiDeleteBinLine aria-hidden className="size-4" />
                          Delete permanently
                        </button>
                      }
                      title={`Delete "${category.name}" permanently?`}
                      description="This erases the category for good. Any article still filed under it, drafts included, blocks the delete, so it can only go once nothing points at it."
                      confirmLabel="Delete permanently"
                      tone="danger"
                      isPending={isDeletingCategoryForever}
                      onConfirm={() =>
                        deleteCategoryForever(category._id, {
                          onSuccess: () => {
                            setRestored(null);
                            setRemoved(category.name);
                          },
                        })
                      }
                    />
                  </div>
                );

              default:
                return null;
            }
          }}
          footer={
            <ListFooter
              total={
                categoriesQuery.isLoading ? undefined : categoryRows.length
              }
              shown={categoryRows.length}
              noun="removed category"
              pluralNoun="removed categories"
              page={1}
              totalPages={1}
              pageSize={Math.max(categoryRows.length, 1)}
              onPageChange={() => undefined}
              isLoading={categoriesQuery.isLoading}
              isError={categoriesQuery.isError}
              context={searchTerm ? `, matching "${searchTerm}"` : null}
            />
          }
        />
      </>
    );
  };

  const commentsBody = () => {
    if (commentsQuery.isError) {
      return (
        <EmptyState
          variant="inline"
          icon={<PiChatCircle className="size-5" />}
          title="Removed comments could not be loaded"
          description={
            commentsQuery.error?.message ||
            "The request failed. Check that the API is running, then try again."
          }
          action={
            <button
              type="button"
              onClick={() => void commentsQuery.refetch()}
              className={quietButton}
            >
              Try again
            </button>
          }
        />
      );
    }

    return (
      <>
        <SelectionBar
          count={commentSelection.count}
          noun="comment"
          onClear={commentSelection.clear}
        >
          <BulkDeleteForever
            count={commentSelection.count}
            noun="comment"
            isPending={isDeletingCommentsForever}
            onConfirm={() =>
              deleteCommentsInBulkForever(commentSelection.keys, {
                onSuccess: () => commentSelection.clear(),
              })
            }
          />
        </SelectionBar>

        <DataTable
          columns={[
            { key: "comment", header: "Comment", className: "min-w-[22rem]" },
            { key: "article", header: "Article", className: "min-w-[10rem]" },
            { key: "author", header: "Author" },
            { key: "changed", header: "Last changed" },
            { key: "actions", header: "Actions", align: "right" },
          ]}
          rows={commentRows}
          getRowKey={(row) => row._id}
          isLoading={commentsQuery.isLoading}
          minWidth="60rem"
          caption="Removed comments, most recently changed first"
          selection={commentSelection}
          rowLabel={(row) =>
            `Select the comment by ${row.user?.fullName || "a member"}`
          }
          emptyState={
            <EmptyState
              variant="inline"
              icon={<PiChatCircle className="size-5" />}
              title={
                needle
                  ? "No removed comment matches this search"
                  : "No comments in the trash"
              }
              description={
                needle
                  ? `No comment in the trash has "${searchTerm}" in its text, article or author. Clear the search to see every removed comment.`
                  : "Comments moderated out of the queue wait here. A comment has no restore, so a row here is on its way out."
              }
              action={
                needle ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className={quietButton}
                  >
                    Clear the search
                  </button>
                ) : (
                  <Link href="/admin/manage-comments" className={linkClass}>
                    Open comment management
                  </Link>
                )
              }
            />
          }
          renderCell={(comment, columnKey) => {
            switch (columnKey) {
              case "comment":
                return (
                  <span className="line-clamp-2 max-w-[24rem] text-default-700">
                    {comment.content || "No text"}
                  </span>
                );

              case "article":
                return (
                  <span className="block max-w-[14rem] truncate text-default-600">
                    {comment.post?.title || "Article removed"}
                  </span>
                );

              case "author":
                return (
                  <span className="block max-w-[12rem] truncate text-default-600">
                    {comment.user?.fullName || "Removed member"}
                  </span>
                );

              case "changed":
                return (
                  <span className="whitespace-nowrap text-xs tabular-nums text-default-600">
                    {formatDate(comment.updatedAt || comment.createdAt) ||
                      "Not recorded"}
                  </span>
                );

              case "actions":
                return (
                  <div className="flex items-center justify-end">
                    <ConfirmDialog
                      trigger={
                        <button
                          type="button"
                          className={dangerButton}
                          aria-label="Delete this comment permanently"
                        >
                          <RiDeleteBinLine aria-hidden className="size-4" />
                          Delete permanently
                        </button>
                      }
                      title="Delete this comment permanently?"
                      description="This erases the comment for good. The article's comment count was already corrected when the comment left the queue."
                      confirmLabel="Delete permanently"
                      tone="danger"
                      isPending={isDeletingCommentForever}
                      onConfirm={() =>
                        deleteCommentForever(comment._id, {
                          onSuccess: () => {
                            setRestored(null);
                            setRemoved(
                              `The comment by ${
                                comment.user?.fullName || "a member"
                              }`,
                            );
                          },
                        })
                      }
                    />
                  </div>
                );

              default:
                return null;
            }
          }}
          footer={
            <ListFooter
              total={commentsQuery.isLoading ? undefined : commentRows.length}
              shown={commentRows.length}
              noun="removed comment"
              page={1}
              totalPages={1}
              pageSize={Math.max(commentRows.length, 1)}
              onPageChange={() => undefined}
              isLoading={commentsQuery.isLoading}
              isError={commentsQuery.isError}
              context={searchTerm ? `, matching "${searchTerm}"` : null}
            />
          }
        />
      </>
    );
  };

  const tabledTabs: Tab[] = ["articles", "members", "categories", "comments"];

  const searchPlaceholder: Record<Tab, string> = {
    articles: "Title or slug",
    members: "Name, username or email",
    categories: "Name or description",
    comments: "Text, article or author",
  };

  const panelLabel: Record<Tab, string> = {
    articles: "Removed articles",
    members: "Removed members",
    categories: "Removed categories",
    comments: "Removed comments",
  };

  // The two newer lists answer in one request, so a page size is noise there.
  const isPaged = tab === "articles" || tab === "members";

  return (
    <div className="space-y-4">
      <ListFrame label="Removed articles, accounts, categories and comments">
        <DataToolbar
          filters={tabs}
          activeFilter={tab}
          onFilterChange={(key) => {
            const next = tabledTabs.find((item) => item === key);
            if (next) changeTab(next);
          }}
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder={searchPlaceholder[tab]}
          right={
            isPaged ? (
              <ListSelect
                label="Per page"
                hideLabel
                value={limit}
                onChange={(value) =>
                  filters.set({ limit: Number(value) || PAGE_SIZES[0] })
                }
                options={PAGE_SIZE_OPTIONS}
              />
            ) : undefined
          }
        />

        <div
          id={`${panelId}-panel`}
          role="tabpanel"
          aria-label={panelLabel[tab]}
        >
          {tab === "articles"
            ? articlesBody()
            : tab === "members"
              ? membersBody()
              : tab === "categories"
                ? categoriesBody()
                : commentsBody()}
        </div>
      </ListFrame>

      <div aria-live="polite" aria-atomic="true">
        {restored ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-success/30 bg-success/5 px-4 py-3 text-sm">
            <p>
              <span className="font-semibold">{restored.name}</span> is back as
              a live {restored.what === "account" ? "member" : restored.what}.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              {restored.href ? (
                <Link href={restored.href} className={linkClass}>
                  {restored.what === "article"
                    ? "Open the article"
                    : restored.what === "category"
                      ? "Open categories"
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
        last changed. Every tab searches the whole trash, so a search finds a
        record on any page.{" "}
        {articleCount !== undefined && memberCount !== undefined ? (
          <span className="tabular-nums">
            {plural(articleCount ?? 0, "article")},{" "}
            {plural(memberCount, "account")},{" "}
            {plural(categoryCount ?? 0, "category", "categories")} and{" "}
            {plural(commentCount ?? 0, "comment")} in total.
          </span>
        ) : null}
      </p>
    </div>
  );
};

export default TrashManager;
