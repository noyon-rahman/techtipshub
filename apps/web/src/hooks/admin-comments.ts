"use client";

/**
 * Comment moderation hooks.
 *
 * useAdminComments({ page?, limit?, searchTerm?, within?: "24h" | "7d" | "all" })
 *   -> { data: <API envelope>, rows: TAdminComment[], meta, isLoading,
 *        isFetching, isError, refetch }
 *      reads `GET /admin/comments` (rows are the bare `data` array, `meta` beside
 *      it). `within` is the API's own time filter; leave it out for "all".
 *
 * useCommentCounts() -> data: { total, last24h, last7d } (isError on failure)
 * useLatestComments() -> the dashboard's recent-comment strip
 *
 * useDeleteAdminComment() -> mutate({ commentId, onDeleted? }); invalidates the
 * list, both count queries and the latest strip.
 */
import {
  deleteCommentsPermanently,
  getAdminComments,
  getCommentCounts,
  getLatestComments,
  getTrashedComments,
  readCommentPage,
} from "@/services/admin/comments";
import { readRows } from "@/services/admin/shared";
import { deleteCommentAsAdmin } from "@/services/blog";
import type { IAdminCommentsParams, TAdminComment } from "@/types/admin.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  keepPreviousData,
  toAdminList,
  type IAdminList,
  type IAdminListResult,
} from "./admin-list";

export const ADMIN_COMMENT_PAGE_SIZE = 20;

export const QUERY_KEYS = {
  list: ["ADMIN_COMMENTS"],
  counts: ["COMMENT_COUNTS"],
  latest: ["ADMIN_LATEST_COMMENTS"],
} as const;

export type TAdminCommentsParams = IAdminCommentsParams;

export const useAdminComments = (
  params: TAdminCommentsParams = {},
): IAdminList<TAdminComment, IAdminListResult<TAdminComment>> => {
  const page = params.page ?? 1;
  const limit = params.limit ?? ADMIN_COMMENT_PAGE_SIZE;
  const within = params.within ?? "all";

  const query = useQuery({
    queryKey: [
      ...QUERY_KEYS.list,
      page,
      limit,
      params.searchTerm ?? "",
      within,
      params.sort ?? "",
    ],
    queryFn: async () => {
      const payload = await getAdminComments({
        page,
        limit,
        searchTerm: params.searchTerm || undefined,
        within,
        sort: params.sort || undefined,
      });
      const { rows, meta } = readCommentPage(payload, { page, limit });

      return { rows, meta, raw: payload };
    },
    // Page switches keep the previous rows on screen instead of flashing a skeleton.
    placeholderData: keepPreviousData,
  });

  return toAdminList(query);
};

export const useCommentCounts = () => {
  return useQuery({
    queryKey: QUERY_KEYS.counts,
    queryFn: async () => await getCommentCounts(),
  });
};

export const useLatestComments = () => {
  return useQuery({
    queryKey: QUERY_KEYS.latest,
    queryFn: async () => await getLatestComments(10),
  });
};

export const useDeleteAdminComment = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { commentId: string; onDeleted?: () => void }>(
    {
      mutationKey: ["ADMIN_DELETE_COMMENT"],
      mutationFn: async ({ commentId }) =>
        await deleteCommentAsAdmin(commentId),
      onSuccess: (data, variables) => {
        if (data?.success === false) {
          toast.error(data?.message || "The comment could not be deleted.", {
            id: "admin-delete-comment",
          });
          return;
        }

        toast.success(data?.message || "Comment moved to Trash", {
          id: "admin-delete-comment",
        });

        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.counts });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.latest });
        variables.onDeleted?.();
      },
      onError: (error) => {
        toast.error(error?.message || "The comment could not be deleted.", {
          id: "admin-delete-comment",
        });
      },
    },
  );
};

/** Reads the trash's comment tab. */
export const TRASHED_COMMENTS_KEY = ["TRASHED_COMMENTS"] as const;
/**
 * Moves picked comments to the trash in one press.
 *
 * One request per comment, because the API has no bulk endpoint for the way
 * in: the single admin delete already runs its own transaction and adjusts the
 * article's comment count. A failure stops the run and says how many moved, so
 * the list is never described as emptier than it is.
 */
export const useDeleteAdminCommentsInBulk = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string[]>({
    mutationKey: ["ADMIN_DELETE_COMMENTS_BULK"],
    mutationFn: async (ids) => {
      let moved = 0;

      for (const id of ids) {
        try {
          await deleteCommentAsAdmin(id);
          moved += 1;
        } catch {
          throw new Error(
            `${moved} ${moved === 1 ? "comment" : "comments"} moved to Trash, then the next one failed. Reload to see what is left.`,
          );
        }
      }

      return moved;
    },
    onSuccess: (moved) => {
      toast.success(
        `${moved} ${moved === 1 ? "comment" : "comments"} moved to Trash.`,
        { id: "admin-delete-comments-bulk" },
      );

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.counts });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.latest });
      queryClient.invalidateQueries({ queryKey: TRASHED_COMMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ["ADMIN_TRASH_COUNTS"] });
    },
    onError: (error) => {
      toast.error(error.message, { id: "admin-delete-comments-bulk" });

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.counts });
      queryClient.invalidateQueries({ queryKey: TRASHED_COMMENTS_KEY });
    },
  });
};

export const useTrashedComments = () => {
  const query = useQuery({
    queryKey: TRASHED_COMMENTS_KEY,
    queryFn: async () => await getTrashedComments(),
  });

  return {
    rows: readRows<TAdminComment>(query.data),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

/** Erases removed comments for good, one id or a picked selection. */
export const useDeleteCommentsPermanently = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string | string[]>({
    mutationKey: ["ADMIN_DELETE_COMMENTS_PERMANENT"],
    mutationFn: async (ids) =>
      await deleteCommentsPermanently(Array.isArray(ids) ? ids : [ids]),
    onSuccess: (data) => {
      const deleted = Number(data?.data?.deleted ?? 0);

      toast.success(
        `${deleted} ${deleted === 1 ? "comment" : "comments"} deleted for good.`,
        { id: "admin-delete-comments-permanent" },
      );

      queryClient.invalidateQueries({ queryKey: TRASHED_COMMENTS_KEY });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.list });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.counts });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.latest });
      queryClient.invalidateQueries({ queryKey: ["ADMIN_TRASH_COUNTS"] });
    },
    onError: (error) => {
      toast.error(error.message, { id: "admin-delete-comments-permanent" });
    },
  });
};
