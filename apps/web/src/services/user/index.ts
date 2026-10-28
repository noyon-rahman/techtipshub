"use server";

import envConfig from "@/config/env.config";
import { legacyResponse } from "@/lib/api-contract";
import type { TLegacyBody } from "@/lib/api-contract";
import axiosInstance from "@/lib/AxiosInstance";
import type { IFollowResult } from "@techtipshub/shared";
import { TSocialLink } from "@/types";
import { updateTag } from "next/cache";

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
    const res = await axiosInstance.patch(`/users/update-profile`, payload);

    updateTag("loggedInUserProfile");
    // A username or photo change also changes the public profile page.
    updateTag("singleUser");

    return res.data;
  } catch (err: any) {
    return err.response.data;
  }
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

// delete an user account (admin only)
export const deleteUserAccount = async (id: string) => {
  try {
    const res = await axiosInstance.delete(`/admin/users/${id}`);

    return res?.data;
  } catch (err: any) {
    return err?.response?.data;
  }
};
