import axiosInstance from "@/lib/AxiosInstance";
import { getTrashedCategories } from "@/services/admin/categories";
import { getTrashedComments } from "@/services/admin/comments";
import type {
  IAdminTrashParams,
  ITrashedBlog,
  ITrashedUser,
} from "@/types/admin.type";
import {
  cleanParams,
  isSuccessful,
  readMeta,
  readRows,
  toServiceError,
} from "./shared";

export interface ITrashParams extends IAdminTrashParams {}

/**
 * Members keep their single-row trash here; the bulk actions live with the
 * rest of the member writes and are re-exported so a caller of the trash
 * needs one import.
 */
export {
  deleteUsersInBulk,
  deleteUsersPermanentlyInBulk,
} from "@/services/user";

/**
 * `GET /admin/blogs/trash` (Admin) -> `{ success, data: IBlog[], meta }`.
 *
 * Takes the page, size and `searchTerm`. Throws on failure.
 */
export const getTrashedBlogs = async (params: ITrashParams = {}) => {
  try {
    const res = await axiosInstance.get("/admin/blogs/trash", {
      params: cleanParams(params),
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "Deleted articles did not load.");
  }
};

export const readTrashedBlogPage = (
  payload: unknown,
  params: ITrashParams = {},
) => {
  const rows = readRows<ITrashedBlog>(payload);

  return {
    rows,
    meta: readMeta(payload, rows.length, params.page, params.limit),
  };
};

// PATCH /admin/blogs/:id/restore (Admin)
export const restoreBlog = async (id: string) => {
  try {
    const res = await axiosInstance.patch(`/admin/blogs/${id}/restore`);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The article could not be restored.");
  }
};

/**
 * `GET /admin/users/trash` (Admin) -> `{ success, data: IUser[], meta }`.
 *
 * Takes `page` and `limit`. Throws on failure.
 */
export const getTrashedUsers = async (params: ITrashParams = {}) => {
  try {
    const res = await axiosInstance.get("/admin/users/trash", {
      params: cleanParams(params),
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "Deleted members did not load.");
  }
};

export const readTrashedUserPage = (
  payload: unknown,
  params: ITrashParams = {},
) => {
  const rows = readRows<ITrashedUser>(payload);

  return {
    rows,
    meta: readMeta(payload, rows.length, params.page, params.limit),
  };
};

// PATCH /admin/users/:id/restore (Admin)
export const restoreUser = async (id: string) => {
  try {
    const res = await axiosInstance.patch(`/admin/users/${id}/restore`);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The member could not be restored.");
  }
};

/** `DELETE /admin/users/:id/permanent` (Admin). Only a trashed account. */
export const deleteUserPermanently = async (id: string) => {
  try {
    const res = await axiosInstance.delete(`/admin/users/${id}/permanent`);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The member could not be deleted.");
  }
};

/**
 * How many accounts are in the trash.
 *
 * The list endpoints page at the default ten rows and return their count only
 * for the page they answered, so the article tab cannot read a member count
 * from what it already fetched. The users request asks for one row, which
 * carries the same total. A failure returns `undefined` and the tab drops the
 * badge rather than showing a zero it did not measure.
 */
export const getTrashedUserCount = async (): Promise<number | undefined> => {
  try {
    const res = await axiosInstance.get("/admin/users/trash", {
      params: { page: 1, limit: 1 },
    });

    if (!isSuccessful(res.data)) return undefined;

    const total = Number(readMeta(res.data, 1, 1, 1).total);
    return Number.isFinite(total) ? total : undefined;
  } catch {
    return undefined;
  }
};

/** Trash tab badges in one call; a count is `undefined` when unmeasured. */
export const getTrashCounts = async (): Promise<{
  blogs?: number;
  users?: number;
  categories?: number;
  comments?: number;
}> => {
  const [blogs, users, categories, comments] = await Promise.all([
    getTrashedBlogs({ page: 1, limit: 1 })
      .then((payload) =>
        isSuccessful(payload) ? readTrashCount(payload) : undefined,
      )
      .catch(() => undefined),
    getTrashedUserCount(),
    // The two newer trash lists are not paged, so their length is the count.
    getTrashedCategories()
      .then((payload) =>
        isSuccessful(payload) ? readRows<unknown>(payload).length : undefined,
      )
      .catch(() => undefined),
    getTrashedComments()
      .then((payload) =>
        isSuccessful(payload) ? readRows<unknown>(payload).length : undefined,
      )
      .catch(() => undefined),
  ]);

  return { blogs, users, categories, comments };
};

const readTrashCount = (payload: unknown): number | undefined => {
  const total = Number(readMeta(payload, 1, 1, 1).total);

  return Number.isFinite(total) ? total : undefined;
};
