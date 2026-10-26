import axiosInstance from "@/lib/AxiosInstance";
import type { IAdminMembersParams } from "@/types/admin.type";
import type { IUser } from "@/types";
import { cleanParams, readMeta, readRows, toServiceError } from "./shared";

/**
 * `GET /admin/users/:id` (Admin) -> `{ success, data: IUser }`.
 *
 * Answers one live member, whatever page of the list they sit on. A deleted
 * account is not in it: that answers 404, because deletion is a soft delete
 * and the trash is the only view that opts out of it.
 *
 * `undefined` means "no such member". Any other failure throws, so the screen
 * can tell a missing member from a lookup that never arrived.
 */
export const getAdminMember = async (
  memberId: string,
): Promise<IUser | undefined> => {
  try {
    const res = await axiosInstance.get(`/admin/users/${memberId}`);

    return (res.data?.data as IUser | undefined) ?? undefined;
  } catch (error) {
    const failed = toServiceError(error, "This member could not be loaded.");

    if ((failed as Error & { status?: number }).status === 404) {
      return undefined;
    }

    throw failed;
  }
};

/**
 * `GET /admin/users` (Admin) -> `{ success, data: IUser[], meta }`.
 *
 * Takes `page`, `limit`, `searchTerm`, `sort`, `role` and `status`. Throws on
 * failure so a table can show the error instead of an empty list.
 */
export const getAdminUsers = async (params: IAdminMembersParams = {}) => {
  try {
    const res = await axiosInstance.get("/admin/users", {
      params: cleanParams(params),
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "Members did not load.");
  }
};

export const readMemberPage = (
  payload: unknown,
  params: IAdminMembersParams = {},
) => {
  const rows = readRows<IUser>(payload);

  return {
    rows,
    meta: readMeta(payload, rows.length, params.page, params.limit),
  };
};

// Members who follow this account. Rows are `{ follower: {...} }` wrappers,
// so callers read `row.follower`.
export const getMemberFollowers = async (
  userId: string,
  params: { page?: number; limit?: number } = {},
) => {
  try {
    const res = await axiosInstance.get(`/users/${userId}/followers`, {
      params,
    });

    return res.data;
  } catch (error: any) {
    return error?.response?.data;
  }
};

// Accounts this member follows. Rows are `{ following: {...} }` wrappers.
export const getMemberFollowing = async (
  userId: string,
  params: { page?: number; limit?: number } = {},
) => {
  try {
    const res = await axiosInstance.get(`/users/${userId}/following`, {
      params,
    });

    return res.data;
  } catch (error: any) {
    return error?.response?.data;
  }
};

/**
 * `PATCH /admin/users/:id` (Admin) -> `{ success, data: IUser }`.
 *
 * The body is multipart: `data` holds the JSON of the fields being changed and
 * `image` carries a new profile photo. The browser sets the boundary, so no
 * Content-Type header is sent by hand. Throws on failure.
 */
export const updateMemberProfile = async (id: string, payload: FormData) => {
  try {
    const res = await axiosInstance.patch(`/admin/users/${id}`, payload);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The profile could not be saved.");
  }
};
