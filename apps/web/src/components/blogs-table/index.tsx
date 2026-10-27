"use client";

import { formatDate } from "@/components/admin/format";
import {
  ListSelect,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZES,
  quietButton,
  useDebouncedTerm,
} from "@/components/admin/list-controls";
import ConfirmDialog from "@/components/modules/admin/kit/confirm-dialog";
import DataTable, {
  type DataTableColumn,
} from "@/components/modules/admin/kit/data-table";
import DataToolbar from "@/components/modules/admin/kit/data-toolbar";
import EmptyState from "@/components/modules/admin/kit/empty-state";
import ListFooter from "@/components/modules/admin/kit/list-footer";
import ListFrame from "@/components/modules/admin/kit/list-frame";
import { focusRing } from "@/components/modules/admin/kit/tau";
import Thumbnail from "@/components/modules/admin/kit/thumbnail";
import { useAdminBlogs, useDeleteAdminBlog } from "@/hooks/admin-blogs";
import { useAdminCategories } from "@/hooks/admin-categories";
import { adminEditBlogPath } from "@/lib/blog-routes";
import type { IBlog } from "@/types";
import Link from "next/link";
import { useCallback, useState } from "react";
import { FiArrowUpRight, FiEdit3, FiSearch, FiTrash2 } from "react-icons/fi";
import { MdOutlineArticle } from "react-icons/md";
import RowMenu from "../users-table/row-menu";

/** The API's own sort fields (`ADMIN_BLOG_SORT_FIELDS`); `-` is newest first. */
const SORTS = [
  { key: "newest", label: "Newest first", sort: "-createdAt" },
  { key: "views", label: "Most viewed", sort: "-totalViews" },
  { key: "comments", label: "Most commented", sort: "-totalComments" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

const isSortKey = (value: string | null | undefined): value is SortKey =>
  SORTS.some((option) => option.key === value);

const sortOf = (key: SortKey) =>
  SORTS.find((option) => option.key === key)?.sort ?? "-createdAt";

const count = (value?: number) => (value ?? 0).toLocaleString("en-GB");

const displayName = (blog: IBlog) =>
  blog.author?.fullName?.trim() || blog.author?.username || "";

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
  { key: "published", header: "Published", className: "whitespace-nowrap" },
  { key: "actions", header: "Actions", align: "right" },
];

const menuItem = `flex min-h-11 w-full items-center gap-2 rounded-[5px] px-2.5 text-left text-sm text-foreground transition-colors hover:bg-default-100 focus-visible:bg-default-100 ${focusRing}`;

const dangerItem = `flex min-h-11 w-full items-center gap-2 rounded-[5px] px-2.5 text-left text-sm text-danger transition-colors hover:bg-danger/10 focus-visible:bg-danger/10 ${focusRing}`;

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

/** Cover, title and slug, the first column of every article row. */
const ArticleCell = ({ blog }: { blog: IBlog }) => {
  const title = blog.title?.trim() || "Untitled article";

  return (
    <div className="flex max-w-[26rem] items-start gap-3">
      <Thumbnail src={blog.coverImage} size={40} />
      <div className="min-w-0">
        {blog.slug ? (
          <Link
            href={`/blogs/${blog.slug}`}
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
 * Published articles. Search, category, sort, page size and page are the API's
 * own query parameters, so the footer total and the pager describe every
 * published piece rather than the rows on screen.
 *
 * Removing an article sends it to Trash. The "Deleted" tab that used to sit
 * next to Published duplicated that screen, so this one list has one job.
 */
const BlogsTable = ({ initialSort }: { initialSort?: string }) => {
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

  const { mutate: deleteBlog, isPending: isDeleting } = useDeleteAdminBlog();

  // One call for the whole list: the category endpoint is not paged.
  const categories = useAdminCategories().rows;

  const { rows, meta, isLoading, isFetching, isError, error, refetch } =
    published;

  const totalPages = Math.max(meta?.totalPages ?? 1, 1);
  const pageSize = meta?.limit ?? limit;

  // A removal can empty the last page. Stepping back keeps the table on a
  // page that still exists instead of an empty frame the filters did not empty.
  const onDeleted = useCallback(() => {
    if (page > 1 && rows.length <= 1)
      setPage((current) => Math.max(1, current - 1));
  }, [page, rows.length]);

  const isFiltered = Boolean(searchTerm) || category !== "all";

  const clearFilters = () => {
    setQuery("");
    setCategory("all");
    setPage(1);
  };

  const emptyState = isError ? (
    <EmptyState
      variant="inline"
      icon={<MdOutlineArticle className="size-5" />}
      title="Articles could not be loaded"
      description={
        error?.message ||
        "The articles request failed. Check that the API is running, then try again."
      }
      action={
        <button
          type="button"
          onClick={() => void refetch()}
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
        searchTerm ? `"${searchTerm}"` : "this category"
      }. Clear the filters to see every published article.`}
      action={
        <button type="button" onClick={clearFilters} className={quietButton}>
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
    />
  );

  return (
    <ListFrame label="Published articles">
      <DataToolbar
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Title, slug or author"
        right={
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
            <ListSelect
              label="Per page"
              hideLabel
              value={limit}
              onChange={(value) => {
                setLimit(Number(value) || PAGE_SIZES[0]);
                setPage(1);
              }}
              options={PAGE_SIZE_OPTIONS}
            />
          </>
        }
      />

      <DataTable
        caption="Published articles, newest first"
        columns={COLUMNS}
        rows={rows}
        getRowKey={(blog) => blog._id}
        isLoading={isLoading}
        skeletonRows={Math.min(limit, 10)}
        emptyState={emptyState}
        minWidth="64rem"
        renderCell={(blog, key) => {
          switch (key) {
            case "article":
              return <ArticleCell blog={blog} />;

            case "author": {
              if (!blog.author?._id) {
                return (
                  <span className="text-xs text-default-600">
                    Author not recorded
                  </span>
                );
              }

              return (
                <Link
                  href={`/admin/manage-users/${blog.author._id}`}
                  className={`block max-w-[11rem] rounded-sm ${focusRing}`}
                >
                  <span className="block truncate font-medium">
                    {displayName(blog) || "Unnamed member"}
                  </span>
                  {blog.author.username && (
                    <span className="block truncate text-xs text-default-600">
                      @{blog.author.username}
                    </span>
                  )}
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
              return <span>{count(blog.totalViews)}</span>;

            case "comments":
              return (
                <span
                  className={
                    (blog.totalComments ?? 0) > 0 ? "" : "text-default-600"
                  }
                >
                  {count(blog.totalComments)}
                </span>
              );

            case "votes":
              return (
                <span className="text-xs">
                  <span className="text-success-700 dark:text-success">
                    {count(blog.upVotes)}
                  </span>
                  <span aria-hidden className="px-1 text-default-400">
                    /
                  </span>
                  <span className="text-danger">{count(blog.downVotes)}</span>
                  <span className="sr-only"> up and down votes</span>
                </span>
              );

            case "published":
              return (
                <span className="text-xs tabular-nums text-default-700">
                  {formatDate(blog.createdAt) || "Not recorded"}
                </span>
              );

            case "actions": {
              const title = blog.title?.trim() || "this article";
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
      />

      <ListFooter
        total={meta?.total}
        shown={rows.length}
        noun="article"
        page={meta?.page ?? page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={setPage}
        isLoading={isLoading && !meta}
        isError={isError}
        context={
          isFiltered
            ? `, ${searchTerm ? `matching "${searchTerm}"` : "in this category"}`
            : null
        }
      />

      <p className="sr-only" role="status">
        {isFetching && !isLoading ? "Refreshing articles" : ""}
      </p>
    </ListFrame>
  );
};

export default BlogsTable;
