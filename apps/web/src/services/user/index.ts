"use server";

import envConfig from "@/config/env.config";
import { legacyResponse } from "@/lib/api-contract";
import type { TLegacyBody } from "@/lib/api-contract";
import { publicProfilePath } from "@/lib/blog-routes";
import axiosInstance from "@/lib/AxiosInstance";
import { readReaderSession } from "@/lib/reader-session";
import { getBlogs } from "@/services/blog";
import { toServiceError } from "@/services/admin/shared";
import { readReaderUsername } from "@/services/reader/interests";
import { readUsernameState as readUsernameChangeState } from "@/services/reader/username";
import type { IFollowResult, IUsernameChangeState } from "@techtipshub/shared";
import type { IBlog, IUser, TSocialLink } from "@/types";
import { revalidatePath, updateTag } from "next/cache";

/**
 * Authors the follow list can suggest to a member who follows nobody yet.
 *
 * Read from the public article list rather than from a "popular members" query
 * of its own: whoever wrote the articles the ranking already leads with is a
 * writer a reader of this site has actually been reading. The member's own
 * handle is dropped, because suggesting that someone follow themselves is the
 * one suggestion that is always wrong.
 */
export const getAuthorsToFollow = async (
  ownUsername?: string | null,
  limit = 3,
) => {
  const data = await getBlogs({ limit: "24", sort: "ranking" });
  const rows = Array.isArray(data?.data) ? (data.data as IBlog[]) : [];

  const seen = new Set<string>();
  const authors: IUser[] = [];

  for (const row of rows) {
    const author = row.author;
    if (!author?._id || !author.username) continue;
    if (author.username === ownUsername) continue;
    if (seen.has(author.username)) continue;

    seen.add(author.username);
    authors.push(author);

    if (authors.length === limit) break;
  }

  return authors;
};

/**
 * A member's public profile.
 *
 * Cached, because it is the same answer for every visitor: this is what lets
 * `/users/<username>` and the follower lists be prerendered instead of
 * rendered per request. Tagged `singleUser` so a profile edit expires it.
 */
export const getUserByUsername = async (username: string) => {
  try {
    const res = await fetch(`${envConfig.baseApi}/users/${username}`, {
      next: {
        tags: ["singleUser"],
        revalidate: 43200,
      },
    });

    return legacyResponse<unknown>(res);
  } catch (err: any) {
    throw new Error(err?.message);
  }
};

/**
 * Whether the signed-in reader follows `userId`, with that member's current
 * follower count. Used when a page has no answer of its own yet; the button
 * stays quiet until it has one.
 */
export const getUserFollowingStatus = async (
  userId: string,
): Promise<TLegacyBody<IFollowResult>> => {
  try {
    const res = await axiosInstance.get(`/users/${userId}/follow-status`);

    return res.data;
  } catch (err: any) {
    return err?.response?.data ?? { success: false, message: err?.message };
  }
};

export const followUser = async (
  userId: string,
): Promise<TLegacyBody<IFollowResult>> => {
  try {
    const res = await axiosInstance.put(`/users/${userId}/follow`);

    updateTag("singleUser");

    return res.data;
  } catch (err: any) {
    return err?.response?.data ?? { success: false, message: err?.message };
  }
};

export const unfollowUser = async (
  userId: string,
): Promise<TLegacyBody<IFollowResult>> => {
  try {
    const res = await axiosInstance.delete(`/users/${userId}/unfollow`);

    updateTag("singleUser");

    return res.data;
  } catch (err: any) {
    return err?.response?.data ?? { success: false, message: err?.message };
  }
};

/**
 * A member's follower list.
 *
 * Public (the API answers without a session), so it is cached and tagged: the
 * follower pages can then be prerendered instead of rendering per visitor.
 */
export const getFollowersByUserId = async (userId: string) => {
  try {
    const res = await fetch(`${envConfig.baseApi}/users/${userId}/followers`, {
      next: { tags: ["followers"], revalidate: 43200 },
    });

    return legacyResponse<unknown>(res);
  } catch (error: any) {
    throw new Error(error?.message);
  }
};

/**
 * A member's following list. Public and cached for the same reason as the
 * follower list above.
 */
export const getFollowingByUserId = async (userId: string) => {
  try {
    const res = await fetch(`${envConfig.baseApi}/users/${userId}/following`, {
      next: { tags: ["following"], revalidate: 43200 },
    });

    return legacyResponse<unknown>(res);
  } catch (error: any) {
    throw new Error(error?.message);
  }
};

// get all users (admin only)
// `GET /admin/users` is built on QueryBuilder, so it already understands `page`,
// `limit`, `searchTerm`, `sort`, `role` and `status`. Forwarding them is what
// lets the members table page through more than its first page.
// Throws with the API's own message on failure so the table shows an error.
export const getAllUsers = async (params?: Record<string, unknown>) => {
  try {
    const res = await axiosInstance.get("/admin/users", { params });

    return res.data;
  } catch (err: any) {
    throw new Error(
      err?.response?.data?.message || err?.message || "Members did not load.",
    );
  }
};

// block a user by user id (admin only)
export const blockUser = async (userId: string) => {
  try {
    const res = await axiosInstance.patch(`/admin/users/${userId}/block`);

    return res.data;
  } catch (err: any) {
    throw new Error(err.message);
  }
};

// unblock a user by user id (admin only)
export const unblockUser = async (userId: string) => {
  try {
    const res = await axiosInstance.patch(`/admin/users/${userId}/unblock`);

    return res.data;
  } catch (err: any) {
    throw new Error(err.message);
  }
};

export const updateProfile = async (payload: FormData) => {
  try {
    // Read before the save so the address the member is leaving is known: a
    // handle change must expire the page at the old one as well as the new.
    const before = await readReaderUsername();
    const res = await axiosInstance.patch(`/users/update-profile`, payload);
    const after = await readReaderUsername();

    updateTag("loggedInUserProfile");
    // A username or photo change also changes the public profile page.
    updateTag("singleUser");

    if (before && after && before !== after) {
      // The old address now redirects. Expiring both paths means a reader
      // reaches the redirect and the new page without waiting out the cache.
      revalidatePath(publicProfilePath(before));
      revalidatePath(publicProfilePath(after));
    }

    return res.data;
  } catch (err: any) {
    return err.response.data;
  }
};

/**
 * The handle lock as this member stands under it.
 *
 * Read by the profile form after load, the same way the interests are: the
 * profile page is a server render and the profile also serves a session on the
 * reader's own account, so the date is asked for rather than guessed.
 */
export const readUsernameState = async (): Promise<
  TLegacyBody<IUsernameChangeState>
> => {
  const { accessToken } = await readReaderSession();

  return readUsernameChangeState(accessToken);
};

export const updateSocialLinks = async (payload: {
  socialLinks: TSocialLink[];
}) => {
  try {
    const res = await axiosInstance.put(
      `/users/profile/update-social-links`,
      payload,
    );

    updateTag("loggedInUserProfile");

    return res?.data;
  } catch (err: any) {
    return err?.response?.data;
  }
};

// make user to admin (admin only)
export const makeAdmin = async (id: string) => {
  try {
    const res = await axiosInstance.patch(`/admin/users/${id}/make-admin`);

    return res?.data;
  } catch (err: any) {
    return err?.response?.data;
  }
};

export const resendVerificationEmail = async (id: string) => {
  try {
    const res = await axiosInstance.post(
      `/admin/users/${id}/resend-verification`,
    );

    return res?.data;
  } catch (err: any) {
    return err?.response?.data ?? { success: false, message: err?.message };
  }
};

// delete an user account (admin only)
export const deleteUserAccount = async (id: string) => {
  try {
    const res = await axiosInstance.delete(`/admin/users/${id}`);

    return res?.data;
  } catch (err: any) {
    return err?.response?.data;
  }
};

/**
 * `POST /admin/users/bulk-delete` (Admin). Moves the picked members to the
 * trash; one admin account refuses the whole selection.
 */
export const deleteUsersInBulk = async (ids: string[]) => {
  try {
    const res = await axiosInstance.post("/admin/users/bulk-delete", { ids });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The members could not be deleted.");
  }
};

/**
 * `POST /admin/users/trash/permanent` (Admin). Erases trashed members for
 * good; one account that is not in the trash refuses the whole selection.
 */
export const deleteUsersPermanentlyInBulk = async (ids: string[]) => {
  try {
    const res = await axiosInstance.post("/admin/users/trash/permanent", {
      ids,
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The members could not be deleted for good.");
  }
};
