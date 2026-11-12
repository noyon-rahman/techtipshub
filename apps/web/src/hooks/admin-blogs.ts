"use client";

/**
 * Articles hooks.
 *
 * useAdminBlogs({ page?, limit?, searchTerm?, sort?, category?, author?, status? })
 *   -> { rows: IBlog[], meta, isLoading, isFetching, isError, error, refetch, data }
 *      reads `GET /admin/blogs`; `data` is the API's raw envelope. `isError` is
 *      true when the endpoint fails (including a 404 from an API that has not
 *      shipped it yet) and `rows` stays `[]`, so the screen never crashes.
 *      `rows` are in `data` (a bare array) beside `meta`; a flattened or
 *      `data.result` answer is read the same way.
 *
 * useTrashedBlogs({ page?, limit?, searchTerm? })
 *   -> same shape, from `GET /admin/blogs/trash`.
 *
 * Paging keeps the previous rows on screen. Only `searchTerm` changes trigger a
 * search, so debounce the input before passing it.
 *
 * useTrashCounts() -> data: { blogs?, users? }
 * Mutations: useDeleteAdminBlog(), useDeleteAdminBlogPermanently(),
 * useDeleteAdminBlogsInBulk(), useDeleteAdminBlogsPermanentlyInBulk(),
 * useRestoreTrashedBlog(), useCreateAdminBlog(), usePublishAdminBlog().
 */
import {
  createAdminBlog,
  deleteAdminBlog,
  deleteAdminBlogPermanently,
  deleteAdminBlogsInBulk,
  deleteAdminBlogsPermanentlyInBulk,
  getAdminBlogList,
  getAdminTrashedBlogList,
  publishAdminBlog,
  readBlogPage,
} from "@/services/admin/blogs";
import { getTrashCounts } from "@/services/admin/trash";
import type { IAdminBlogsParams, IAdminTrashParams } from "@/types/admin.type";
import type { IBlog } from "@/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  keepPreviousData,
  toAdminList,
  type IAdminList,
  type IAdminListResult,
} from "./admin-list";

/** The restore mutation is one implementation, in `admin-trash.ts`. */
export { useRestoreBlog as useRestoreTrashedBlog } from "./admin-trash";

export const ADMIN_BLOG_PAGE_SIZE = 10;

/** Invalidated by the mutations here and in `admin-trash.ts`. */
export const ADMIN_BLOGS_KEY = ["ADMIN_BLOGS"] as const;
export const TRASHED_BLOGS_KEY = ["TRASHED_BLOGS"] as const;
export const TRASH_COUNTS_KEY = ["ADMIN_TRASH_COUNTS"] as const;

export type TAdminBlogParams = IAdminBlogsParams;
export type TTrashedBlogParams = IAdminTrashParams;

export const useAdminBlogs = (
  params: TAdminBlogParams = {},
): IAdminList<IBlog, IAdminListResult<IBlog>> => {
  const page = params.page ?? 1;
  const limit = params.limit ?? ADMIN_BLOG_PAGE_SIZE;

  const query = useQuery({
    // Every field that reaches the API is part of the key.
    queryKey: [
      ...ADMIN_BLOGS_KEY,
      page,
      limit,
      params.searchTerm ?? "",
      params.sort ?? "",
      params.category ?? "",
      params.author ?? "",
      params.status ?? "",
    ],
    queryFn: async () => {
      const payload = await getAdminBlogList({
        page,
        limit,
        searchTerm: params.searchTerm || undefined,
        sort: params.sort || undefined,
        category: params.category || undefined,
        author: params.author || undefined,
        status: params.status || undefined,
      });
      const { rows, meta } = readBlogPage(payload, { page, limit });

      return { rows, meta, raw: payload };
    },
    placeholderData: keepPreviousData,
  });

  return toAdminList(query);
};

export const useTrashedBlogs = (
  params: TTrashedBlogParams = {},
): IAdminList<IBlog, IAdminListResult<IBlog>> => {
  const page = params.page ?? 1;
  const limit = params.limit ?? ADMIN_BLOG_PAGE_SIZE;

  const query = useQuery({
    queryKey: [
      ...TRASHED_BLOGS_KEY,
      page,
      limit,
      params.searchTerm ?? "",
      params.category ?? "",
      params.sort ?? "",
    ],
    queryFn: async () => {
      const payload = await getAdminTrashedBlogList({
        page,
        limit,
        searchTerm: params.searchTerm || undefined,
        category: params.category || undefined,
        sort: params.sort || undefined,
      });
      const { rows, meta } = readBlogPage(payload, { page, limit });

      return { rows, meta, raw: payload };
    },
    placeholderData: keepPreviousData,
  });

  return toAdminList(query);
};

/** Tab badges for the trash screen; a missing count shows no number. */
export const useTrashCounts = () =>
  useQuery({
    queryKey: TRASH_COUNTS_KEY,
    queryFn: async () => await getTrashCounts(),
    staleTime: 30_000,
  });

/** Moves an article to the trash; refreshes the list and both badges. */
export const useDeleteAdminBlog = () => {
  const queryClient = useQueryClient();

  return useMutation<
    any,
    Error,
    { id: string; reason?: string; onDeleted?: () => void }
  >({
    mutationKey: ["ADMIN_DELETE_BLOG"],
    mutationFn: async ({ id, reason }) => await deleteAdminBlog(id, reason),
    onSuccess: (data, variables) => {
      if (data?.success === false) {
        toast.error(data?.message || "The article could not be deleted.", {
          id: "admin-delete-blog",
        });
        return;
      }

      toast.success(data?.message || "Article moved to the trash", {
        id: "admin-delete-blog",
      });

      queryClient.invalidateQueries({ queryKey: ADMIN_BLOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TRASHED_BLOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TRASH_COUNTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["GET_ALL_BLOGS"] });
      variables.onDeleted?.();
    },
    onError: (error) => {
      toast.error(error?.message || "The article could not be deleted.", {
        id: "admin-delete-blog",
      });
    },
  });
};

/** Erases a trashed article for good; refreshes the trash and both badges. */
export const useDeleteAdminBlogPermanently = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: string; onDeleted?: () => void }>({
    mutationKey: ["ADMIN_DELETE_BLOG_PERMANENT"],
    mutationFn: async ({ id }) => await deleteAdminBlogPermanently(id),
    onSuccess: (data, variables) => {
      if (data?.success === false) {
        toast.error(data?.message || "The article could not be deleted.", {
          id: "admin-delete-blog-permanent",
        });
        return;
      }

      toast.success(data?.message || "Article deleted for good", {
        id: "admin-delete-blog-permanent",
      });

      queryClient.invalidateQueries({ queryKey: TRASHED_BLOGS_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_BLOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TRASH_COUNTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["GET_ALL_BLOGS"] });
      variables.onDeleted?.();
    },
    onError: (error) => {
      toast.error(error?.message || "The article could not be deleted.", {
        id: "admin-delete-blog-permanent",
      });
    },
  });
};

/**
 * An article written for a member, live or as a draft.
 *
 * The form is already built by the caller (multipart, with the cover file),
 * so this only owns the request and the refresh: the list holds drafts too, and
 * the public feed and sitemap have to drop or gain the article.
 */
export const useCreateAdminBlog = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, FormData>({
    mutationKey: ["ADMIN_CREATE_BLOG"],
    mutationFn: async (payload) => await createAdminBlog(payload),
    onSuccess: (data) => {
      if (data?.success === false) {
        toast.error(data?.message || "The article could not be saved.", {
          id: "admin-create-blog",
        });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ADMIN_BLOGS_KEY });
      queryClient.invalidateQueries({ queryKey: ["GET_ALL_BLOGS"] });
    },
  });
};

/**
 * Moves picked articles to the trash in one press.
 *
 * No author email leaves from here, unlike the single-row delete: a selection
 * of twenty must not become twenty inboxes. Everything else the single action
 * touches (counters, comments, votes, the category total) moves the same way.
 */
export const useDeleteAdminBlogsInBulk = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string[]>({
    mutationKey: ["ADMIN_DELETE_BLOGS_BULK"],
    mutationFn: async (ids) => await deleteAdminBlogsInBulk(ids),
    onSuccess: (data) => {
      const deleted = Number(data?.data?.deleted ?? 0);
      const skipped = Number(data?.data?.skipped ?? 0);

      toast.success(
        `${deleted} ${deleted === 1 ? "article" : "articles"} moved to Trash${
          skipped > 0 ? `. ${skipped} were already there.` : "."
        }`,
        { id: "admin-delete-blogs-bulk" },
      );

      queryClient.invalidateQueries({ queryKey: ADMIN_BLOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TRASHED_BLOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TRASH_COUNTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["GET_ALL_BLOGS"] });
      queryClient.invalidateQueries({ queryKey: ["GET_FEED_BLOGS"] });
    },
    onError: (error) => {
      toast.error(error.message, { id: "admin-delete-blogs-bulk" });
    },
  });
};

/** Erases picked trashed articles for good. */
export const useDeleteAdminBlogsPermanentlyInBulk = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string[]>({
    mutationKey: ["ADMIN_DELETE_BLOGS_PERMANENT_BULK"],
    mutationFn: async (ids) => await deleteAdminBlogsPermanentlyInBulk(ids),
    onSuccess: (data) => {
      const deleted = Number(data?.data?.deleted ?? 0);

      toast.success(
        `${deleted} ${deleted === 1 ? "article" : "articles"} deleted for good.`,
        { id: "admin-delete-blogs-permanent-bulk" },
      );

      queryClient.invalidateQueries({ queryKey: ADMIN_BLOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TRASHED_BLOGS_KEY });
      queryClient.invalidateQueries({ queryKey: TRASH_COUNTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["GET_ALL_BLOGS"] });
    },
    onError: (error) => {
      toast.error(error.message, { id: "admin-delete-blogs-permanent-bulk" });
    },
  });
};

/** Takes a draft live under its author's byline. */
export const usePublishAdminBlog = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: string; onPublished?: () => void }>({
    mutationKey: ["ADMIN_PUBLISH_BLOG"],
    mutationFn: async ({ id }) => await publishAdminBlog(id),
    onSuccess: (data, variables) => {
      if (data?.success === false) {
        toast.error(data?.message || "The draft could not be published.", {
          id: "admin-publish-blog",
        });
        return;
      }

      toast.success(
        data?.message || "Draft published. Readers can open it now.",
        { id: "admin-publish-blog" },
      );

      queryClient.invalidateQueries({ queryKey: ADMIN_BLOGS_KEY });
      queryClient.invalidateQueries({ queryKey: ["GET_ALL_BLOGS"] });
      variables.onPublished?.();
    },
    onError: (error) => {
      toast.error(error?.message || "The draft could not be published.", {
        id: "admin-publish-blog",
      });
    },
  });
};
