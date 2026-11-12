"use client";

/**
 * Category hooks.
 *
 * useAdminCategories({ searchTerm? })
 *   -> { data: <API envelope>, rows: IAdminCategory[], total, isLoading,
 *        isFetching, isError, refetch }
 *      reads `GET /admin/categories` (`{ success, data: { result, total } }`).
 *      `searchTerm` is sent to the API; when the API ignores it the screen can
 *      still filter `rows` on the client, which is what it did before.
 *
 * Mutations: useCreateCategory(), useUpdateCategory(), useDeleteCategory(),
 * useDeleteCategoriesInBulk(), useTrashedCategories(), useRestoreCategory(),
 * useDeleteCategoryPermanently().
 * A duplicate name (409) resolves with the API body instead of throwing, so the
 * form can read `message`/`errorSources`; each one refreshes the list.
 */
import {
  createCategory,
  deleteCategoriesInBulk,
  deleteCategoriesPermanentlyInBulk,
  deleteCategory,
  getAdminCategories,
  getTrashedCategories,
  readCategoryList,
  restoreCategory,
  updateCategory,
  type ICategoryPayload,
} from "@/services/admin/categories";
import { readRows } from "@/services/admin/shared";
import type {
  IAdminCategoriesParams,
  IAdminCategory,
} from "@/types/admin.type";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  keepPreviousData,
  toAdminList,
  type IAdminList,
  type IAdminListResult,
} from "./admin-list";

export const CATEGORIES_KEY = ["ADMIN_CATEGORIES"] as const;

export type TAdminCategoriesParams = IAdminCategoriesParams;

type TCategoryListResult = IAdminListResult<IAdminCategory> & { total: number };

/**
 * Every category, filtered by `searchTerm` when one is given. The list is
 * small enough that the panel asks for all of it in one request.
 */
export const useAdminCategories = (
  params: TAdminCategoriesParams = {},
): IAdminList<IAdminCategory, TCategoryListResult> & { total: number } => {
  const query = useQuery({
    queryKey: [...CATEGORIES_KEY, params.searchTerm ?? ""],
    queryFn: async () => {
      const payload = await getAdminCategories({
        searchTerm: params.searchTerm || undefined,
      });
      const { rows, total } = readCategoryList(payload);

      return {
        rows,
        total,
        meta: { page: 1, limit: total, total, totalPages: total > 0 ? 1 : 0 },
        raw: payload,
      };
    },
    placeholderData: keepPreviousData,
  });

  const list = toAdminList<IAdminCategory, TCategoryListResult>(query);

  return { ...list, total: query.data?.total ?? 0 };
};

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, ICategoryPayload>({
    mutationKey: ["CREATE_CATEGORY"],
    mutationFn: async (payload) => await createCategory(payload),
    onSuccess: (data) => {
      // A duplicate name comes back as `{ success: false }` with a 409; the
      // form puts that message on the name field, so no toast here.
      if (data?.success) {
        toast.success(data?.message || "Category created", {
          id: "create-category",
        });
        queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      }
    },
    onError: (error) => {
      toast.error(error?.message || "The category could not be created", {
        id: "create-category-error",
      });
    },
  });
};

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: string; payload: ICategoryPayload }>({
    mutationKey: ["UPDATE_CATEGORY"],
    mutationFn: async (payload) => await updateCategory(payload),
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(data?.message || "Category updated", {
          id: "update-category",
        });
        queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      }
    },
    onError: (error) => {
      toast.error(error?.message || "The category could not be updated", {
        id: "update-category-error",
      });
    },
  });
};

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string>({
    mutationKey: ["DELETE_CATEGORY"],
    mutationFn: async (id) => await deleteCategory(id),
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(data?.message || "Category deleted", {
          id: "delete-category",
        });
        queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      } else if (data?.message) {
        // 409: the category still has articles.
        toast.error(data.message, { id: "delete-category" });
      }
    },
    onError: (error) => {
      toast.error(error?.message || "The category could not be deleted", {
        id: "delete-category-error",
      });
    },
  });
};

/** Moves picked categories to the trash; one still in use refuses the set. */
export const useDeleteCategoriesInBulk = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string[]>({
    mutationKey: ["DELETE_CATEGORIES_BULK"],
    mutationFn: async (ids) => await deleteCategoriesInBulk(ids),
    onSuccess: (data) => {
      const deleted = Number(data?.data?.deleted ?? 0);

      toast.success(
        `${deleted} ${deleted === 1 ? "category" : "categories"} moved to Trash.`,
        { id: "delete-categories-bulk" },
      );

      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      queryClient.invalidateQueries({ queryKey: TRASHED_CATEGORIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["ADMIN_TRASH_COUNTS"] });
    },
    onError: (error) => {
      toast.error(error.message, { id: "delete-categories-bulk" });
    },
  });
};

export const TRASHED_CATEGORIES_KEY = ["TRASHED_CATEGORIES"] as const;

export const useTrashedCategories = () => {
  const query = useQuery({
    queryKey: TRASHED_CATEGORIES_KEY,
    queryFn: async () => await getTrashedCategories(),
  });

  return {
    rows: readRows<IAdminCategory>(query.data),
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
};

export const useRestoreCategory = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string>({
    mutationKey: ["RESTORE_CATEGORY"],
    mutationFn: async (id) => await restoreCategory(id),
    onSuccess: () => {
      toast.success("Category restored.", { id: "restore-category" });

      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      queryClient.invalidateQueries({ queryKey: TRASHED_CATEGORIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["ADMIN_TRASH_COUNTS"] });
    },
    onError: (error) => {
      toast.error(error.message, { id: "restore-category" });
    },
  });
};

export const useDeleteCategoryPermanently = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, string | string[]>({
    mutationKey: ["DELETE_CATEGORY_PERMANENT"],
    mutationFn: async (ids) =>
      await deleteCategoriesPermanentlyInBulk(Array.isArray(ids) ? ids : [ids]),
    onSuccess: (_data, ids) => {
      const count = Array.isArray(ids) ? ids.length : 1;

      toast.success(
        `${count} ${count === 1 ? "category" : "categories"} deleted for good.`,
        { id: "delete-category-permanent" },
      );

      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY });
      queryClient.invalidateQueries({ queryKey: TRASHED_CATEGORIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["ADMIN_TRASH_COUNTS"] });
    },
    onError: (error) => {
      toast.error(error.message, { id: "delete-category-permanent" });
    },
  });
};
