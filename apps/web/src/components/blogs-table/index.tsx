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
import SelectionBar from "@/components/modules/admin/kit/selection-bar";
import { focusRing } from "@/components/modules/admin/kit/tau";
import Thumbnail from "@/components/modules/admin/kit/thumbnail";
import useRowSelection from "@/components/modules/admin/kit/use-row-selection";
import {
  useAdminBlogs,
  useDeleteAdminBlog,
  useDeleteAdminBlogsInBulk,
  usePublishAdminBlog,
} from "@/hooks/admin-blogs";
import { useAdminCategories } from "@/hooks/admin-categories";
import { listParam, useAdminListParams } from "@/hooks/use-admin-list-params";
import { adminEditBlogPath } from "@/lib/blog-routes";
import type { IBlog } from "@/types";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiArrowUpRight,
  FiEdit3,
  FiSearch,
  FiSend,
  FiTrash2,
} from "react-icons/fi";
import { MdOutlineArticle } from "react-icons/md";
import RowMenu from "../users-table/row-menu";

/** The API's own sort fields (`ADMIN_BLOG_SORT_FIELDS`); `-` is newest first. */
const SORTS = [
  { key: "newest", label: "Newest first", sort: "-createdAt" },
  { key: "views", label: "Most viewed", sort: "-totalViews" },
  { key: "comments", label: "Most commented", sort: "-totalComments" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

/**
 * The view lives in the URL, so a reload, a bookmark or a shared link returns
 * the same tab, page, page size and search. The API sorts by field name, so the
 * URL carries the sort key the select shows and the request gets `sortOf(key)`.
 */
const ARTICLE_LIST = {
  status: listParam({
    values: ["published", "draft"] as const,
    default: "published",
    resetsPage: true,
  }),
  searchTerm: listParam({ default: "", resetsPage: true }),
  category: listParam({ default: "all", resetsPage: true }),
  sort: listParam({
    values: ["newest", "views", "comments"] as const,
    default: "newest",
    resetsPage: true,
  }),
  page: listParam({ default: 1 }),
  limit: listParam({
    default: PAGE_SIZES[0],
    allowed: PAGE_SIZES,
    resetsPage: true,
  }),
} as const;

/**
 * True for a value this screen knows. The rows themselves are literal options,
 * not the schema's union, so the option checks stay next to them.
 */
const isSortKey = (value: string | null | undefined): value is SortKey =>
  SORTS.some((option) => option.key === value);

const sortOf = (key: SortKey) =>
  SORTS.find((option) => option.key === key)?.sort ?? "-createdAt";

const count = (value?: number) => (value ?? 0).toLocaleString("en-GB");

/**
 * A stored article is published unless it says otherwise: rows written before
 * drafts existed carry no status, and they are live.
 */
const isDraft = (blog: IBlog) => blog.status === "draft";

/** A row written before access was a choice was members only. */
const accessOf = (blog: IBlog) =>
  blog.access === "public" ? "public" : "members";

const displayName = (blog: IBlog) =>
  blog.author?.fullName?.trim() || blog.author?.username || "";

const COLUMNS: DataTableColumn[] = [
  { key: "article", header: "Article", className: "min-w-[15rem]" },
  { key: "author", header: "Author", className: "min-w-[9rem]" },
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
  // A draft has an address but no page: opening it would 404 for the admin.
  const publicHref =
    blog.slug && !isDraft(blog) ? `/blogs/${blog.slug}` : undefined;

  return (
    <div className="flex max-w-[26rem] items-start gap-3">
      <Thumbnail src={blog.coverImage} size={40} />
      <div className="min-w-0">
        {publicHref ? (
          <Link
            href={publicHref}
            className={`line-clamp-2 rounded-sm font-medium leading-snug hover:text-primary-accessible ${focusRing}`}
          >
            {title}
          </Link>
        ) : (
          <span className="line-clamp-2 font-medium leading-snug">{title}</span>
        )}
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-default-600">
          <span className="truncate">
            {blog.slug ? `/${blog.slug}` : "No slug recorded"}
          </span>
          {isDraft(blog) && (
            <span className="shrink-0 rounded-full border border-warning-300 px-1.5 text-[0.6875rem] font-medium text-warning-700 dark:border-warning/60 dark:text-warning">
              Draft
            </span>
          )}
          {/* Who the published piece is open to. A draft has no readers yet,
              so it says nothing here. */}
          {!isDraft(blog) && (
            <span className="shrink-0">
              {accessOf(blog) === "public" ? "Everyone" : "Members only"}
            </span>
          )}
        </span>
      </div>
    </div>
  );
};

/**
 * The article table, two views of it: what readers can see, and the drafts
 * written for a member but not published yet.
 *
 * Search, category, sort, page size and page are the API's own query
 * parameters, so the footer total and the pager describe every article in the
 * view rather than the rows on screen. Only count tabs are left to the client,
 * and they come from a second one-row request.
 *
 * All six are in the URL, so a reload, a bookmark or a shared link returns the
 * same view.
 *
 * Removing an article sends it to Trash. Publishing a draft takes it live under
 * its author's byline, which is also when its author and category counts move.
 */
const BlogsTable = () => {
  const filters = useAdminListParams(ARTICLE_LIST);
  const tab = filters.values.status;
  const { page, limit, searchTerm } = filters.values;
  const category = filters.values.category;
  const sort = filters.values.sort;

  // The debounce stays here; the hook takes the settled term. Refing the setter
  // (not the whole hook) keeps the timer from restarting on every URL change.
  const [query, setQuery] = useState(searchTerm);
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

  const articleSort = sortOf(sort);

  const list = useAdminBlogs({
    page,
    limit,
    searchTerm,
    category,
    sort: articleSort,
    status: tab,
  });

  // The tab counts: one row is enough for `meta.total`, and it is asked for
  // without the search or category, so each tab counts its own whole view.
  const publishedCount = useAdminBlogs({
    page: 1,
    limit: 1,
    sort: articleSort,
    status: "published",
  });
  const draftCount = useAdminBlogs({
    page: 1,
    limit: 1,
    sort: articleSort,
    status: "draft",
  });

  const { mutate: deleteBlog, isPending: isDeleting } = useDeleteAdminBlog();
  const { mutate: deleteBlogsInBulk, isPending: isDeletingInBulk } =
    useDeleteAdminBlogsInBulk();
  const { mutate: publishBlog, isPending: isPublishing } =
    usePublishAdminBlog();

  // One call for the whole list: the category endpoint is not paged.
  const categories = useAdminCategories().rows;

  const { rows, meta, isLoading, isFetching, isError, error, refetch } = list;

  const totalPages = Math.max(meta?.totalPages ?? 1, 1);
  const pageSize = meta?.limit ?? limit;

  // A removal or a publish can empty the last page. Stepping back keeps the
  // table on a page that still exists instead of an empty frame the filters
  // did not empty.
  const stepBackIfEmpty = useCallback(() => {
    if (page > 1 && rows.length <= 1) filtersRef.current({ page: page - 1 });
  }, [page, rows.length]);

  const isFiltered = Boolean(searchTerm) || category !== "all";
  const isDrafts = tab === "draft";
  const noun = isDrafts ? "draft" : "article";

  const selection = useRowSelection({
    rows,
    getKey: (blog) => blog._id,
    resetWith: `${tab}:${category}:${searchTerm}:${sort}:${page}`,
    selectAllLabel: `Select every ${noun} on this page`,
  });

  const clearFilters = () => {
    setQuery("");
    filters.set({ searchTerm: "", category: "all" });
  };

  const tabs = [
    {
      key: "published",
      label: "Published",
      count: publishedCount.meta?.total,
    },
    { key: "draft", label: "Drafts", count: draftCount.meta?.total },
  ];

  const emptyState = isError ? (
    <EmptyState
      variant="inline"
      icon={<MdOutlineArticle className="size-5" />}
      title={
        isDrafts ? "Drafts could not be loaded" : "Articles could not be loaded"
      }
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
      title={
        isDrafts ? "No drafts match this view" : "No articles match this view"
      }
      description={`Nothing in ${noun}s matches ${
        searchTerm ? `"${searchTerm}"` : "this category"
      }. Clear the filters to see every ${noun} in this view.`}
      action={
        <button type="button" onClick={clearFilters} className={quietButton}>
          Clear search and filters
        </button>
      }
    />
  ) : isDrafts ? (
    <EmptyState
      variant="inline"
      icon={<MdOutlineArticle className="size-5" />}
      title="No drafts waiting"
      description="A draft written for a member appears here until it is published, under that member's byline."
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
    <ListFrame label={isDrafts ? "Draft articles" : "Published articles"}>
      <DataToolbar
        filters={tabs}
        activeFilter={tab}
        onFilterChange={(key) => {
          filters.set({ status: key === "draft" ? "draft" : "published" });
        }}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Title, slug or author"
        right={
          <>
            <ListSelect
              label="Category"
              hideLabel
              value={category}
              onChange={(value) => filters.set({ category: value })}
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
                if (isSortKey(value)) filters.set({ sort: value });
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
              onChange={(value) =>
                filters.set({ limit: Number(value) || PAGE_SIZES[0] })
              }
              options={PAGE_SIZE_OPTIONS}
            />
          </>
        }
      />

      <SelectionBar
        count={selection.count}
        noun={noun}
        onClear={selection.clear}
      >
        <ConfirmDialog
          trigger={
            <button
              type="button"
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-[6px] border border-danger/40 px-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 sm:min-h-9 ${focusRing}`}
            >
              <FiTrash2 aria-hidden className="size-4" />
              Move to Trash
            </button>
          }
          title={`Move ${selection.count} ${noun}${selection.count === 1 ? "" : "s"} to the trash?`}
          description="They leave the feed and their authors' profiles, with their comments, views and votes. Trash keeps them restorable. No email goes to the authors from a bulk move; the activity log names every title."
          confirmLabel="Move to Trash"
          isPending={isDeletingInBulk}
          onConfirm={() =>
            deleteBlogsInBulk(selection.keys, {
              onSuccess: () => {
                const leaving = selection.count;
                selection.clear();
                if (page > 1 && rows.length <= leaving) {
                  filters.set({ page: page - 1 });
                }
              },
            })
          }
        />
      </SelectionBar>

      <DataTable
        caption="Articles, newest first"
        columns={COLUMNS}
        rows={rows}
        getRowKey={(blog) => blog._id}
        isLoading={isLoading}
        selection={selection}
        rowLabel={(blog) => `Select ${displayName(blog)}`}
        skeletonRows={Math.min(limit, 10)}
        emptyState={emptyState}
        minWidth="52rem"
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
              // A draft has never been published, so it has no date to show and
              // its creation date would read as one.
              return (
                <span className="text-xs tabular-nums text-default-700">
                  {isDraft(blog)
                    ? "Not published"
                    : formatDate(blog.publishedAt ?? blog.createdAt) ||
                      "Not recorded"}
                </span>
              );

            case "actions": {
              const title = blog.title?.trim() || "this article";
              const draft = isDraft(blog);
              const publicHref =
                blog.slug && !draft ? `/blogs/${blog.slug}` : undefined;
              const editorHref = blog._id
                ? adminEditBlogPath(blog._id)
                : undefined;

              return (
                <RowMenu label={`Actions for ${title}`}>
                  {draft ? null : publicHref ? (
                    <MenuLink href={publicHref} external>
                      <FiArrowUpRight aria-hidden className="size-4" />
                      Read on the site
                    </MenuLink>
                  ) : draft ? null : (
                    <span
                      role="menuitem"
                      aria-disabled="true"
                      className="flex min-h-11 w-full items-center gap-2 rounded-[5px] px-2.5 text-sm text-default-400"
                    >
                      <FiArrowUpRight aria-hidden className="size-4" />
                      No public link
                    </span>
                  )}

                  {draft ? (
                    <ConfirmDialog
                      trigger={
                        <button
                          type="button"
                          role="menuitem"
                          className={menuItem}
                        >
                          <FiSend aria-hidden className="size-4" />
                          Publish now
                        </button>
                      }
                      title={`Publish "${title}"?`}
                      description={`It goes live on the site under ${
                        displayName(blog) || "its author"
                      }'s byline, and readers can open it straight away.`}
                      confirmLabel="Publish"
                      onConfirm={() =>
                        publishBlog({
                          id: blog._id,
                          onPublished: stepBackIfEmpty,
                        })
                      }
                    />
                  ) : null}

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
                    description={
                      draft
                        ? "It leaves the drafts list and moves to Trash. Restoring it brings the draft back as it was."
                        : "It leaves the feed and its article page and moves to Trash. Restoring it brings the article back without the comments, views and votes it had."
                    }
                    confirmLabel="Move to the trash"
                    tone="danger"
                    isPending={isDeleting}
                    onConfirm={() =>
                      deleteBlog({
                        id: blog._id,
                        reason: "Removed from the admin articles table",
                        onDeleted: stepBackIfEmpty,
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
        noun={noun}
        page={meta?.page ?? page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={(next) => filters.set({ page: next })}
        isLoading={isLoading && !meta}
        isError={isError}
        context={
          isFiltered
            ? `, ${searchTerm ? `matching "${searchTerm}"` : "in this category"}`
            : null
        }
      />

      <p className="sr-only" role="status">
        {(isFetching && !isLoading) || isPublishing
          ? isPublishing
            ? "Publishing the draft"
            : `Refreshing ${noun}s`
          : ""}
      </p>
    </ListFrame>
  );
};

export default BlogsTable;
