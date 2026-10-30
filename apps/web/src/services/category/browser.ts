import { messageOf } from "@/lib/api-error";
import axiosInstance from "@/lib/AxiosInstance";
import { toServiceError } from "@/services/admin/shared";
import type { ICategory } from "@/types";

/**
 * Category calls made from the browser, beside the server-only list in
 * `./index.ts`.
 *
 * A picker that reloads in place cannot ask a server action for its list, and
 * creating a category needs the member's session, which lives in an httpOnly
 * cookie. Both go through this app's `/api/v1` handler with the session
 * attached.
 */

export interface ICreateCategoryPayload {
  name: string;
}

/** Every category, for a picker that has to show loading and failure states. */
export const getCategoriesForPicker = async (): Promise<ICategory[]> => {
  try {
    // The public list pages at ten by default, and a picker that silently cut
    // the list there would hide categories the writer can see on the site. The
    // bound is the API's own page ceiling.
    const res = await axiosInstance.get("/categories", {
      params: { limit: 100 },
    });

    return (res.data?.data as ICategory[] | undefined) ?? [];
  } catch (error) {
    throw toServiceError(error, "Categories did not load.");
  }
};

/**
 * Creates a category for the member who is writing, and returns it.
 *
 * A name already in use, or one the API rejects, throws: the field picked the
 * name, so the answer belongs on that field rather than in a toast the writer
 * may have scrolled past.
 */
export const createCategoryForComposer = async (
  payload: ICreateCategoryPayload,
): Promise<ICategory> => {
  try {
    const res = await axiosInstance.post("/categories", payload);

    return res.data?.data as ICategory;
  } catch (error) {
    const message = messageOf(error);

    throw new Error(message || "The category could not be created.");
  }
};
