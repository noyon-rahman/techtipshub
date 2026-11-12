import axiosInstance from "@/lib/AxiosInstance";
import type { IAdminBlogsParams, IAdminTrashParams } from "@/types/admin.type";
import type { IBlog } from "@/types";
import { cleanFilter, readMeta, readRows, toServiceError } from "./shared";

export interface IAdminBlogQuery extends IAdminBlogsParams {
  [key: string]: unknown;
}

/**
 * `GET /admin/blogs` (Admin) -> `{ success, data: IBlog[], meta }`.
 *
 * Takes `page`, `limit`, `searchTerm`, `sort`, `category`, `author` and
 * `status`. Throws on failure - including the 404 an API that does not ship
 * the endpoint yet answers with, so the screen shows an error rather than an
 * empty list.
 */
export const getAdminBlogList = async (params: IAdminBlogQuery = {}) => {
  try {
    const res = await axiosInstance.get("/admin/blogs", {
      params: cleanFilter(params),
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "Articles did not load.");
  }
};

/**
 * `GET /admin/blogs/:id` (Admin) -> `{ success, data: IBlog }`.
 *
 * The editor reads the article through this route, so opening it does not
 * count as a reader's view. Throws on failure.
 */
export const getAdminBlog = async (id: string) => {
  try {
    const res = await axiosInstance.get(`/admin/blogs/${id}`);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The article did not load.");
  }
};

/** Rows and `meta` of `getAdminBlogList`, read defensively. */
export const readBlogPage = (
  payload: unknown,
  params: IAdminBlogsParams = {},
) => {
  const rows = readRows<IBlog>(payload);

  return {
    rows,
    meta: readMeta(payload, rows.length, params.page, params.limit),
  };
};

/**
 * `GET /admin/blogs/trash` (Admin) -> `{ success, data: IBlog[], meta }`.
 *
 * Takes `page`, `limit` and `searchTerm`. Throws on failure.
 */
export const getAdminTrashedBlogList = async (
  params: IAdminTrashParams = {},
) => {
  try {
    const res = await axiosInstance.get("/admin/blogs/trash", {
      params: cleanFilter(params),
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "Deleted articles did not load.");
  }
};

// PATCH /admin/blogs/:id/restore (Admin)
export const restoreAdminBlog = async (id: string) => {
  try {
    const res = await axiosInstance.patch(`/admin/blogs/${id}/restore`);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The article could not be restored.");
  }
};

/**
 * `DELETE /admin/blogs/:id/permanent` (Admin).
 *
 * Erases a trashed article. Only a trashed article can be erased, so this is
 * the second step after `deleteAdminBlog`, never a replacement for it.
 */
export const deleteAdminBlogPermanently = async (id: string) => {
  try {
    const res = await axiosInstance.delete(`/admin/blogs/${id}/permanent`);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The article could not be deleted for good.");
  }
};

/**
 * `POST /admin/blogs/bulk-delete` (Admin). Moves the picked articles to the
 * trash with no author email; the activity log still names every title.
 */
export const deleteAdminBlogsInBulk = async (ids: string[]) => {
  try {
    const res = await axiosInstance.post("/admin/blogs/bulk-delete", { ids });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The articles could not be deleted.");
  }
};

/**
 * `POST /admin/blogs/trash/permanent` (Admin). Erases trashed articles; one
 * article that is not in the trash refuses the whole selection.
 */
export const deleteAdminBlogsPermanentlyInBulk = async (ids: string[]) => {
  try {
    const res = await axiosInstance.post("/admin/blogs/trash/permanent", {
      ids,
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The articles could not be deleted for good.");
  }
};

// DELETE /admin/blogs/:id (Admin), with a reason the API records in the log
export const deleteAdminBlog = async (id: string, reason?: string) => {
  try {
    const res = await axiosInstance.delete(`/admin/blogs/${id}`, {
      data: reason ? { reason } : undefined,
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The article could not be deleted.");
  }
};

/**
 * `POST /admin/blogs` (Admin) -> `{ success, data: IBlog }`.
 *
 * An article written on someone's behalf. `userId` is the member whose byline
 * it carries, and `publish` decides whether it goes live now or waits in the
 * list as a draft for them. The body is multipart, the same shape the member
 * composer sends, because the cover arrives as a file.
 */
export const createAdminBlog = async (payload: FormData) => {
  try {
    const res = await axiosInstance.post("/admin/blogs", payload);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The article could not be saved.");
  }
};

/** `PATCH /admin/blogs/:id/publish` (Admin): takes a draft live. */
export const publishAdminBlog = async (id: string) => {
  try {
    const res = await axiosInstance.patch(`/admin/blogs/${id}/publish`);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The draft could not be published.");
  }
};
