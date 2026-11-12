import axiosInstance from "@/lib/AxiosInstance";
import type {
  IAdminCategoriesParams,
  IAdminCategory,
} from "@/types/admin.type";
import { cleanParams, readRows, toServiceError } from "./shared";

export interface ICategoryPayload {
  name: string;
  description?: string;
}

/**
 * `GET /admin/categories` (Admin) -> `{ success, data: { result, total } }`.
 *
 * Takes `searchTerm` (and `page`/`limit`, which the API may ignore for now).
 * Throws on failure.
 */
export const getAdminCategories = async (
  params: IAdminCategoriesParams = {},
) => {
  try {
    const res = await axiosInstance.get("/admin/categories", {
      params: cleanParams(params),
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "Categories did not load.");
  }
};

/** Rows and total of `getAdminCategories`, read defensively. */
export const readCategoryList = (payload: unknown) => {
  const rows = readRows<IAdminCategory>(payload);
  const data = (payload as { data?: { total?: unknown } } | undefined)?.data;
  const total = Number(data?.total);

  return { rows, total: Number.isFinite(total) ? total : rows.length };
};

// POST /admin/categories (Admin)
export const createCategory = async (payload: ICategoryPayload) => {
  try {
    const res = await axiosInstance.post("/admin/categories", payload);

    return res.data;
  } catch (error) {
    // The 409 body carries the server's own "name already exists" message,
    // which the form shows on the name field, so the body is returned rather
    // than thrown.
    return (
      toServiceError(error, "The request failed.") as Error & {
        body?: unknown;
      }
    ).body;
  }
};

// PATCH /admin/categories/:id (Admin)
export const updateCategory = async ({
  id,
  payload,
}: {
  id: string;
  payload: ICategoryPayload;
}) => {
  try {
    const res = await axiosInstance.patch(`/admin/categories/${id}`, payload);

    return res.data;
  } catch (error) {
    return (
      toServiceError(error, "The request failed.") as Error & {
        body?: unknown;
      }
    ).body;
  }
};

// DELETE /admin/categories/:id (Admin), 409 while the category still has articles
export const deleteCategory = async (id: string) => {
  try {
    const res = await axiosInstance.delete(`/admin/categories/${id}`);

    return res.data;
  } catch (error) {
    return (
      toServiceError(error, "The request failed.") as Error & {
        body?: unknown;
      }
    ).body;
  }
};

/**
 * `POST /admin/categories/bulk-delete` (Admin). All or nothing: a category
 * still holding a published article refuses the whole selection.
 */
export const deleteCategoriesInBulk = async (ids: string[]) => {
  try {
    const res = await axiosInstance.post("/admin/categories/bulk-delete", {
      ids,
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The categories could not be deleted.");
  }
};

/** `GET /admin/categories/trash` (Admin). Every trashed category, newest first. */
export const getTrashedCategories = async () => {
  try {
    const res = await axiosInstance.get("/admin/categories/trash");

    return res.data;
  } catch (error) {
    throw toServiceError(error, "Deleted categories did not load.");
  }
};

// PATCH /admin/categories/:id/restore (Admin)
export const restoreCategory = async (id: string) => {
  try {
    const res = await axiosInstance.patch(`/admin/categories/${id}/restore`);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The category could not be restored.");
  }
};

/** `DELETE /admin/categories/:id/permanent` (Admin). Only a trashed category. */
export const deleteCategoryPermanently = async (id: string) => {
  try {
    const res = await axiosInstance.delete(`/admin/categories/${id}/permanent`);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The category could not be deleted.");
  }
};

/**
 * Erases trashed categories for good.
 *
 * The API has no bulk route for categories, so this asks once per id. A
 * failure stops the run and says how many went, instead of reporting the whole
 * selection as done.
 */
export const deleteCategoriesPermanentlyInBulk = async (ids: string[]) => {
  let deleted = 0;

  for (const id of ids) {
    try {
      await deleteCategoryPermanently(id);
      deleted += 1;
    } catch {
      throw new Error(
        `${deleted} ${deleted === 1 ? "category" : "categories"} deleted for good, then the next one failed. Reload to see what is left.`,
      );
    }
  }

  return { data: { deleted } };
};
