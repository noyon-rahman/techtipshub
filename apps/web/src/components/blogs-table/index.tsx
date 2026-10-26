"use client";

import { ListSelect, useDebouncedTerm } from "@/components/admin/list-controls";
import { formatCount, formatDate } from "@/components/admin/format";
import AdminPagination from "@/components/modules/admin/kit/pagination";
import ConfirmDialog from "@/components/modules/admin/kit/confirm-dialog";
import DataTable, {
  type DataTableColumn,
} from "@/components/modules/admin/kit/data-table";
import DataToolbar from "@/components/modules/admin/kit/data-toolbar";
import EmptyState from "@/components/modules/admin/kit/empty-state";
import { focusRing } from "@/components/modules/admin/kit/tau";
import Thumbnail from "@/components/modules/admin/kit/thumbnail";
import {
  useAdminBlogs,
  useDeleteAdminBlog,
  useDeleteAdminBlogPermanently,
  useTrashCounts,
} from "@/hooks/admin-blogs";
import { useAdminCategories } from "@/hooks/admin-categories";
import { useRestoreBlog, useTrashedBlogs } from "@/hooks/admin-trash";
import { adminEditBlogPath, writeBlogPath } from "@/lib/blog-routes";
import type { IBlog } from "@/types";
import Link from "next/link";
import { useCallback, useState } from "react";
import { FiArrowUpRight, FiEdit3, FiSearch, FiTrash2 } from "react-icons/fi";
import { MdOutlineArticle } from "react-icons/md";
import { RiArrowGoBackLine, RiDeleteBinLine } from "react-icons/ri";
import RowMenu from "../users-table/row-menu";

const PAGE_SIZES = [10, 20, 50] as const;

/** The API's own sort fields (`ADMIN_BLOG_SORT_FIELDS`); `-` is newest first. */
const SORTS = [
  { key: "newest", label: "Newest first", sort: "-createdAt" },
  { key: "views", label: "Most viewed", sort: "-totalViews" },
  { key: "comments", label: "Most commented", sort: "-totalComments" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

type Tab = "published" | "deleted";

const isSortKey = (value: string | null | undefined): value is SortKey =>
  SORTS.some((option) => option.key === value);

const sortOf = (key: SortKey) =>
  SORTS.find((option) => option.key === key)?.sort ?? "-createdAt";

const number = (value?: number) =>
  typeof value === "number" ? value.toLocaleString("en-GB") : "0";

const displayName = (blog: IBlog) =>
  blog.author?.fullName?.trim() || blog.author?.username || "";

/** One row per published article. */
const COLUMNS: DataTableColumn[] = [
  { key: "article", header: "Article", className: "min-w-[18rem]" },
  { key: "author", header: "Author", className: "min-w-[10rem]" },
  { key: "category", header: "Category", className: "whitespace-nowrap" },
  {
    key: "views",
    header: "Views",
    align: "right",
    className: "whitespace-nowrap tabular-nums",
  },
  {
    key: "comments",
    header: "Comments",
    align: "right",
    className: "whitespace-nowrap tabular-nums",
  },
  {
    key: "votes",
    header: "Votes",
    align: "right",
    className: "whitespace-nowrap tabular-nums",
  },
  { key: "status", header: "Published", className: "whitespace-nowrap" },
  { key: "actions", header: "Actions", align: "right" },
];

/** A deleted article has no counters worth showing; when it changed is the story. */
const DELETED_COLUMNS: DataTableColumn[] = [
  { key: "article", header: "Article", className: "min-w-[18rem]" },
  { key: "author", header: "Author", className: "min-w-[10rem]" },
  { key: "category", header: "Category", className: "whitespace-nowrap" },
  { key: "changed", header: "Last changed", className: "whitespace-nowrap" },
  { key: "actions", header: "Actions", align: "right" },
];

const menuItem = `flex min-h-11 w-full items-center gap-2 rounded-[5px] px-2.5 text-left text-sm text-foreground transition-colors hover:bg-default-100 focus-visible:bg-default-100 ${focusRing}`;

const dangerItem = `flex min-h-11 w-full items-center gap-2 rounded-[5px] px-2.5 text-left text-sm text-danger transition-colors hover:bg-danger/10 focus-visible:bg-danger/10 ${focusRing}`;

const quietButton = `inline-flex min-h-11 items-center rounded-[6px] border border-default-300 px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-default-100 sm:min-h-9 ${focusRing}`;

const restoreButton = `inline-flex min-h-11 items-center gap-1.5 rounded-[6px] border border-default-300 px-3 text-sm font-medium text-foreground transition-colors hover:bg-default-100 sm:min-h-9 ${focusRing}`;

const deleteForeverButton = `inline-flex min-h-11 items-center gap-1.5 rounded-[6px] border border-danger/40 px-3 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-50 sm:min-h-9 ${focusRing}`;

const MenuLink = ({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) => (
  <Link
    href={href}
    role="menuitem"
    target={external ? "_blank" : undefined}
    rel={external ? "noreferrer" : undefined}
    onClick={(event) => event.stopPropagation()}
    className={menuItem}
  >
    {children}
  </Link>
);

/** Cover, title and slug. Deleted articles pass no href: their page is gone. */
const ArticleCell = ({ blog, href }: { blog: IBlog; href?: string }) => {
  const title = blog.title?.trim() || "Untitled article";

  return (
    <div className="flex max-w-[26rem] items-start gap-3">
      <Thumbnail src={blog.coverImage} size={40} />
      <div className="min-w-0">
        {href ? (
          <Link
            href={href}
            className={`line-clamp-2 rounded-sm font-medium leading-snug hover:text-primary-accessible ${focusRing}`}
          >
            {title}
          </Link>
        ) : (
          <span className="line-clamp-2 font-medium leading-snug">{title}</span>
        )}
        <span className="mt-0.5 block truncate text-xs text-default-600">
          {blog.slug ? `/${blog.slug}` : "No slug recorded"}
        </span>
      </div>
    </div>
  );
};

/**
 * The article list, live rows and deleted ones in one frame. The tab picks the
 * endpoint, the columns and the row action; search, page size and page are the
 * API's own query parameters, so the footer total and the pager describe the
 * whole set, not the ten rows on screen.
 *
 * A page counter is shared because switching tab resets it to 1, so neither
 * list is ever asked for a page the other one moved to.
 */
const BlogsTable = ({ initialSort }: { initialSort?: string }) => {
  const [tab, setTab] = useState<Tab>("published");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortKey>(
    isSortKey(initialSort) ? initialSort : "newest",
  );

  const resetPage = useCallback(() => setPage(1), []);
  const searchTerm = useDebouncedTerm(query, resetPage);

  const published = useAdminBlogs({
    page,
    limit,
    searchTerm,
    category,
    sort: sortOf(sort),
  });
  const deleted = useTrashedBlogs({ page, limit, searchTerm });
  const counts = useTrashCounts();

  const active = tab === "published" ? published : deleted;

  const { mutate: deleteBlog, isPending: isDeleting } = useDeleteAdminBlog();
  const { mutate: restoreBlog, isPending: isRestoring } = useRestoreBlog();
  const { mutate: deleteForever, isPending: isDeletingForever } =
    useDeleteAdminBlogPermanently();

  // One call for the whole list: the category endpoint is not paged.
  const categoriesList = useAdminCategories();
  const categories = categoriesList.rows;

  const { meta, isLoading, isFetching } = active;

  const totalPages = Math.max(meta?.totalPages ?? 1, 1);
  const total = meta?.total ?? 0;
  const pageSize = meta?.limit ?? limit;

  // A removal can empty the last page. Stepping back keeps the table on a
  // page that still exists instead of an empty frame the filters did not empty.
  const onDeleted = useCallback(() => {
    if (page > 1 && published.rows.length <= 1)
      setPage((current) => Math.max(1, current - 1));
  }, [page, published.rows.length]);

  const onRestored = useCallback(() => {
    if (page > 1 && deleted.rows.length <= 1)
      setPage((current) => Math.max(1, current - 1));
  }, [page, deleted.rows.length]);

  const onDeletedForever = useCallback(() => {
    if (page > 1 && deleted.rows.length <= 1)
      setPage((current) => Math.max(1, current - 1));
  }, [page, deleted.rows.length]);

  const changeTab = (next: Tab) => {
    setTab(next);
    setQuery("");
    setPage(1);
  };

  const filters = [
    { key: "published", label: "Published", count: published.meta?.total },
    { key: "deleted", label: "Deleted articles", count: counts.data?.blogs },
  ];

  const isFiltered = Boolean(searchTerm) || category !== "all";

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setPage(1);
  };

  const emptyState =
    tab === "published" ? (
      published.isError ? (
        <EmptyState
          variant="inline"
          icon={<MdOutlineArticle className="size-5" />}
          title="Articles could not be loaded"
          description={
            published.error?.message ||
            "The articles request failed. Check that the API is running, then try again."
          }
          action={
            <button
              type="button"
              onClick={() => void published.refetch()}
              className={quietButton}
            >
              Try again
            </button>
          }
        />
      ) : isFiltered ? (
        <EmptyState
          variant="inline"
          icon={<FiSearch className="size-5" />}
          title="No articles match this view"
          description={`Nothing published matches ${
            searchTerm ? `"${searchTerm}"` : "this combination"
          } and the other filters. Clear them to see every published article.`}
          action={
            <button
              type="button"
              onClick={clearFilters}
              className={quietButton}
            >
              Clear search and filters
            </button>
          }
        />
      ) : (
        <EmptyState
          variant="inline"
          icon={<MdOutlineArticle className="size-5" />}
          title="No published articles yet"
          description="When a member publishes, the piece appears here for review, editing and removal."
          action={
            <Link href={writeBlogPath} className={quietButton}>
              Write the first article
            </Link>
          }
        />
      )
    ) : deleted.isError ? (
      <EmptyState
        variant="inline"
        icon={<MdOutlineArticle className="size-5" />}
        title="Deleted articles could not be loaded"
        description={
          deleted.error?.message ||
          "The deleted articles request failed. Check that the API is running, then try again."
        }
        action={
          <button
            type="button"
            onClick={() => void deleted.refetch()}
            className={quietButton}
          >
            Try again
          </button>
        }
      />
    ) : searchTerm ? (
      <EmptyState
        variant="inline"
        icon={<FiSearch className="size-5" />}
        title="No deleted article matches this search"
        description={`Nothing in the deleted list matches "${searchTerm}". Clear the search to see every deleted article.`}
        action={
          <button
            type="button"
            onClick={() => setQuery("")}
            className={quietButton}
          >
            Clear search
          </button>
        }
      />
    ) : (
      <EmptyState
        variant="inline"
        icon={<MdOutlineArticle className="size-5" />}
        title="No deleted articles"
        description="Articles an admin removes from the published tab land here and stay restorable."
        action={
          <button
            type="button"
            onClick={() => changeTab("published")}
            className={quietButton}
          >
            Back to published articles
          </button>
        }
      />
    );

  const columns = tab === "published" ? COLUMNS : DELETED_COLUMNS;
  const noun = tab === "deleted" ? "deleted article" : "article";

  return (
    <div className="overflow-hidden rounded-xl border border-default/60 bg-content-1">
      <DataToolbar
        filters={filters}
        activeFilter={tab}
        onFilterChange={(key) =>
          changeTab(key === "deleted" ? "deleted" : "published")
        }
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={
          tab === "published" ? "Title, slug or author" : "Title or slug"
        }
        right={
          <>
            {tab === "published" ? (
              <>
                <ListSelect
                  label="Category"
                  hideLabel
                  value={category}
                  onChange={(value) => {
                    setCategory(value);
                    setPage(1);
                  }}
                  options={[
                    { value: "all", label: "All categories" },
                    ...categories.map((item) => ({
                      value: item.name,
                      label: item.name,
                    })),
                  ]}
                />
                <ListSelect
                  label="Sort"
                  hideLabel
                  value={sort}
                  onChange={(value) => {
                    if (isSortKey(value)) setSort(value);
                    setPage(1);
                  }}
                  options={SORTS.map((option) => ({
                    value: option.key,
                    label: option.label,
                  }))}
                />
              </>
            ) : null}
            <ListSelect
              label="Per page"
              hideLabel
              value={limit}
              onChange={(value) => {
                setLimit(Number(value) || PAGE_SIZES[0]);
                setPage(1);
              }}
              options={PAGE_SIZES.map((size) => ({
                value: size,
                label: `${size} per page`,
              }))}
            />
          </>
        }
      />

      <p className="sr-only" role="status">
        {isFetching && !isLoading ? "Loading more articles" : ""}
      </p>

      <DataTable
        caption={
          tab === "published"
            ? "Published articles, across every category"
            : "Deleted articles, restorable from this tab"
        }
        columns={columns}
        rows={active.rows}
        getRowKey={(blog) => blog._id}
        isLoading={isLoading}
        skeletonRows={Math.min(limit, 10)}
        emptyState={emptyState}
        minWidth={tab === "published" ? "64rem" : "52rem"}
        renderCell={(blog, key) => {
          switch (key) {
            case "article":
              return (
                <ArticleCell
                  blog={blog}
                  href={
                    tab === "published" && blog.slug
                      ? `/blogs/${blog.slug}`
                      : undefined
                  }
                />
              );

            case "author": {
              if (!blog.author?._id) {
                return (
                  <span className="text-xs text-default-600">
                    Author not recorded
                  </span>
                );
              }

              const authorName = (
                <>
                  <span className="block truncate font-medium">
                    {displayName(blog) || "Unnamed member"}
                  </span>
                  {blog.author.username && (
                    <span className="block truncate text-xs text-default-600">
                      @{blog.author.username}
                    </span>
                  )}
                </>
              );

              // An article deleted with its author leaves no member row to open.
              if (tab === "deleted")
                return (
                  <span className="block max-w-[11rem]">{authorName}</span>
                );

              return (
                <Link
                  href={`/admin/manage-users/${blog.author._id}`}
                  className={`block max-w-[11rem] rounded-sm ${focusRing}`}
                >
                  {authorName}
                </Link>
              );
            }

            case "category":
              return (
                <span className="block max-w-[10rem] truncate text-default-700">
                  {blog.category?.name || "No category"}
                </span>
              );

            case "views":
              return <span>{number(blog.totalViews)}</span>;

            case "comments":
              return (
                <span
                  className={
                    (blog.totalComments ?? 0) > 0 ? "" : "text-default-600"
                  }
                >
                  {number(blog.totalComments)}
                </span>
              );

            case "votes":
              return (
                <span className="text-xs">
                  <span className="text-success-700 dark:text-success">
                    {number(blog.upVotes)}
                  </span>
                  <span aria-hidden className="px-1 text-default-400">
                    /
                  </span>
                  <span className="text-danger">{number(blog.downVotes)}</span>
                  <span className="sr-only"> up and down votes</span>
                </span>
              );

            case "status":
              return (
                <span className="text-xs tabular-nums text-default-700">
                  {formatDate(blog.createdAt) || "Not recorded"}
                </span>
              );

            case "changed":
              return (
                <span className="whitespace-nowrap text-xs tabular-nums text-default-700">
                  {formatDate(blog.updatedAt) || "Not recorded"}
                </span>
              );

            case "actions": {
              const title = blog.title?.trim() || "this article";

              if (tab === "deleted") {
                return (
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <ConfirmDialog
                      trigger={
                        <button
                          type="button"
                          className={restoreButton}
                          aria-label={`Restore ${title}`}
                        >
                          <RiArrowGoBackLine aria-hidden className="size-4" />
                          Restore
                        </button>
                      }
                      title="Restore this article?"
                      description="It returns to the feed and to its author's profile. Its comments, views and votes were removed with it, so it starts with none."
                      confirmLabel="Restore article"
                      isPending={isRestoring}
                      onConfirm={() =>
                        restoreBlog(blog._id, { onSuccess: onRestored })
                      }
                    />

                    <ConfirmDialog
                      trigger={
                        <button
                          type="button"
                          className={deleteForeverButton}
                          aria-label={`Delete ${title} permanently`}
                        >
                          <RiDeleteBinLine aria-hidden className="size-4" />
                          Delete permanently
                        </button>
                      }
                      title={`Delete "${title}" permanently?`}
                      description="This erases the article and its comments, views and votes for good. It cannot be restored, and its address can be used by another article."
                      confirmLabel="Delete permanently"
                      tone="danger"
                      isPending={isDeletingForever}
                      onConfirm={() =>
                        deleteForever({
                          id: blog._id,
                          onDeleted: onDeletedForever,
                        })
                      }
                    />
                  </div>
                );
              }

              const publicHref = blog.slug ? `/blogs/${blog.slug}` : undefined;
              const editorHref = blog._id
                ? adminEditBlogPath(blog._id)
                : undefined;

              return (
                <RowMenu label={`Actions for ${title}`}>
                  {publicHref ? (
                    <MenuLink href={publicHref} external>
                      <FiArrowUpRight aria-hidden className="size-4" />
                      Read on the site
                    </MenuLink>
                  ) : (
                    <span
                      role="menuitem"
                      aria-disabled="true"
                      className="flex min-h-11 w-full items-center gap-2 rounded-[5px] px-2.5 text-sm text-default-400"
                    >
                      <FiArrowUpRight aria-hidden className="size-4" />
                      No public link
                    </span>
                  )}

                  {editorHref ? (
                    <MenuLink href={editorHref}>
                      <FiEdit3 aria-hidden className="size-4" />
                      Open the editor
                    </MenuLink>
                  ) : null}

                  {blog.author?._id ? (
                    <MenuLink href={`/admin/manage-users/${blog.author._id}`}>
                      Author profile
                    </MenuLink>
                  ) : null}

                  <div role="separator" className="my-1 h-px bg-default/60" />

                  <ConfirmDialog
                    trigger={
                      <button
                        type="button"
                        role="menuitem"
                        className={dangerItem}
                      >
                        <FiTrash2 aria-hidden className="size-4" />
                        Move to the trash
                      </button>
                    }
                    title={`Remove "${title}"?`}
                    description="It leaves the feed and its article page and moves to Trash. Restoring it brings the article back without the comments, views and votes it had."
                    confirmLabel="Move to the trash"
                    tone="danger"
                    isPending={isDeleting}
                    onConfirm={() =>
                      deleteBlog({
                        id: blog._id,
                        reason: "Removed from the admin articles table",
                        onDeleted,
                      })
                    }
                  />
                </RowMenu>
              );
            }

            default:
              return null;
          }
        }}
        footer={
          total > 0 ? (
            <AdminPagination
              page={meta?.page ?? page}
              totalPages={totalPages}
              total={total}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          ) : null
        }
      />

      {total > 0 && totalPages <= 1 ? (
        <p className="border-t border-default/60 bg-default-50/40 px-3 py-2 text-xs tabular-nums text-default-600">
          {formatCount(total)} {total === 1 ? noun : `${noun}s`},{" "}
          {formatCount(active.rows.length)} on this page
        </p>
      ) : null}
    </div>
  );
};

export default BlogsTable;
