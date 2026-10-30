import type { TLegacyBody } from "@/lib/api-contract";
import { messageOf } from "@/lib/api-error";
import axiosInstance from "@/lib/AxiosInstance";
import { toServiceError } from "@/services/admin/shared";
import type { ICategory } from "@/types";

/**
 * Category calls made from the browser, beside the server-only list in
 * `./index.ts`.
 *
 * A picker that reloads in place cannot ask a server action for its list, and
 * a request needs the member's session, which lives in an httpOnly cookie. Both
 * go through this app's `/api/v1` handler with the session attached.
 */

export interface ICategoryRequestPayload {
  name: string;
  description?: string;
}

export interface ICategoryRequest {
  _id: string;
  name: string;
  description?: string;
  status: "pending";
  createdAt: string;
}

/** An approved ask, as `/categories/requests/mine` answers it. */
export interface IApprovedCategoryRequest {
  _id: string;
  name: string;
  status: "approved";
  category?: string;
}

/**
 * An ask this writer made in the current session. Its id is what the draft's
 * `category` carries until an admin approves it.
 */
export interface IRequestedCategory {
  id: string;
  name: string;
}

/** Every category, for a picker that has to show loading and failure states. */
export const getCategoriesForPicker = async (): Promise<ICategory[]> => {
  try {
    const res = await axiosInstance.get("/categories");

    return (res.data?.data as ICategory[] | undefined) ?? [];
  } catch (error) {
    throw toServiceError(error, "Categories did not load.");
  }
};

/**
 * Asks an admin for a category.
 *
 * A refusal (409: the name is already a category, or this member already asked)
 * comes back as the body rather than a thrown error, because the answer belongs
 * on the name field the member just typed into.
 */
export const requestCategory = async (
  payload: ICategoryRequestPayload,
): Promise<TLegacyBody<ICategoryRequest>> => {
  try {
    const res = await axiosInstance.post("/categories/requests", payload);

    return res.data;
  } catch (error) {
    const body = (
      error as { response?: { data?: TLegacyBody<ICategoryRequest> } }
    ).response?.data;

    if (body) return body;

    return {
      success: false,
      message: messageOf(error) ?? "The request was not sent.",
    };
  }
};

/** The asks this member has had approved, each with the category it became. */
export const getMyApprovedCategoryRequests = async (): Promise<
  IApprovedCategoryRequest[]
> => {
  try {
    const res = await axiosInstance.get("/categories/requests/mine");

    return (res.data?.data as IApprovedCategoryRequest[] | undefined) ?? [];
  } catch (error) {
    throw toServiceError(error, "Your category requests did not load.");
  }
};
