import { readMemberPage } from "@/services/admin/members";
import {
  blockUser,
  deleteUserAccount,
  followUser,
  getAllUsers,
  getUserFollowingStatus,
  makeAdmin,
  unblockUser,
  unfollowUser,
  updateProfile,
  updateSocialLinks,
} from "@/services/user";
import { messageOf } from "@/lib/api-error";
import type { TLegacyBody } from "@/lib/api-contract";
import { TSocialLink } from "@/types";
import type { IAdminMembersParams } from "@/types/admin.type";
import type { IFollowResult } from "@techtipshub/shared";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * How this reader stands with one member, as the follow control draws it.
 *
 * `isFollowing` decides the button and `totalFollowers` the count beside it.
 * The member's page is prerendered and shared between visitors, so it carries
 * neither for this reader; the entry below is filled from the API's own
 * answer and then kept for the rest of the tab.
 */
export interface IFollowState {
  isFollowing: boolean;
  totalFollowers: number;
}

/** Follow or unfollow `memberId`, from the state the button is showing. */
export interface IFollowVariables {
  memberId: string;
  before: IFollowState;
}

const followEntries = new Map<string, IFollowState>();
const followListeners = new Map<string, Set<() => void>>();
// The status read in flight, so a press during it waits for it instead of
// sending a second identical request.
const followReads = new Map<string, Promise<IFollowState | undefined>>();

export const readFollowEntry = (memberId: string) =>
  followEntries.get(memberId);

export const setFollowEntry = (memberId: string, state: IFollowState) => {
  followEntries.set(memberId, state);
  followListeners.get(memberId)?.forEach((notify) => notify());
};

export const subscribeToFollow = (memberId: string, notify: () => void) => {
  const listeners = followListeners.get(memberId) ?? new Set<() => void>();
  listeners.add(notify);
  followListeners.set(memberId, listeners);

  return () => {
    listeners.delete(notify);
  };
};

/**
 * The API's answer for this reader and member; one request per member.
 *
 * A refusal (a signed-out reader, a member that no longer exists) is reported
 * as no answer at all, so the button stays quiet rather than claiming the
 * reader does not follow someone.
 */
export const readFollowStatus = (memberId: string) => {
  const inFlight = followReads.get(memberId);
  if (inFlight) return inFlight;

  const read = getUserFollowingStatus(memberId)
    .then((body) =>
      body?.success && body.data
        ? {
            isFollowing: body.data.isFollowing,
            totalFollowers: body.data.totalFollowers,
          }
        : undefined,
    )
    .catch(() => undefined)
    .finally(() => {
      if (followReads.get(memberId) === read) followReads.delete(memberId);
    });

  followReads.set(memberId, read);
  return read;
};

/**
 * Follow and unfollow, optimistically.
 *
 * The button moves on the press (`FollowUnFollowButton` writes the entry and
 * passes `before` here) and the API's answer then replaces the guess, because
 * its follower count includes people this tab never saw. A failure puts back
 * what the press found and says so once.
 */
const useFollowWrite = (
  direction: "follow" | "unfollow",
  mutationKey: string[],
) => {
  return useMutation<TLegacyBody<IFollowResult>, Error, IFollowVariables>({
    mutationKey,
    mutationFn: async ({ memberId }) =>
      direction === "follow"
        ? await followUser(memberId)
        : await unfollowUser(memberId),
    onError: (error, { memberId, before }) => {
      setFollowEntry(memberId, before);

      toast.error(messageOf(error) || "That change was not saved. Try again.", {
        id: "follow-user",
      });
    },
  });
};

export const useFollowUser = () => useFollowWrite("follow", ["FOLLOW_USER"]);

export const useUnfollowUser = () =>
  useFollowWrite("unfollow", ["UNFOLLOW_USER"]);

// Params are part of the cache key: each page, search and filter combination
// keeps its own entry. Callers that pass nothing still get the "first
// response" shape other screens read (`["GET_ALL_USERS"]`).
// `rows` and `meta` are the same answer already unpacked, so a table can page.
export const useGetAllUsers = (params?: Record<string, unknown>) => {
  const query = useQuery({
    queryKey: params ? ["GET_ALL_USERS", params] : ["GET_ALL_USERS"],
    queryFn: async () => await getAllUsers(params),
    placeholderData: keepPreviousData,
  });

  const { rows, meta } = readMemberPage(
    query.data,
    params as IAdminMembersParams | undefined,
  );

  return { ...query, rows, meta };
};

export const useBlockUser = () => {
  return useMutation<any, Error, string>({
    mutationKey: ["BLOCK_USER"],
    mutationFn: async (payload) => await blockUser(payload),
    onSuccess: () => {
      toast.success("User blocked successfully", {
        id: "user-blocked",
      });
    },
    onError: (error) => {
      toast.error(error?.message || "Something went wrong!", {
        id: "user-blocked-error",
      });
    },
  });
};

export const useUnblockUser = () => {
  return useMutation<any, Error, string>({
    mutationKey: ["UNBLOCK_USER"],
    mutationFn: async (payload) => await unblockUser(payload),
    onSuccess: () => {
      toast.success("User unblocked successfully", {
        id: "user-unblocked",
      });
    },
    onError: (error) => {
      toast.error(error?.message || "Something went wrong!", {
        id: "user-unblocked-error",
      });
    },
  });
};

// make user to admin (admin only)
export const useMakeAdmin = () => {
  return useMutation<any, Error, string>({
    mutationKey: ["USER_MAKE_ADMIN"],
    mutationFn: async (userId) => await makeAdmin(userId),
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(data?.message, {
          id: "user-make-admin",
        });
      }

      if (data?.success) {
        toast.success(data?.message, {
          id: "user-make-admin",
        });
      }
    },
  });
};

// delete an user account (admin only)

export const useDeleteUserAccount = () => {
  return useMutation<any, Error, string>({
    mutationKey: ["DELETE_USER_ACCOUNT"],
    mutationFn: async (userId) => await deleteUserAccount(userId),
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(data?.message, {
          id: "delete-user-account",
        });
      }

      if (data?.success) {
        toast.success(data?.message, {
          id: "delete-user-account",
        });
      }
    },
  });
};

export const useUpdateProfile = () => {
  return useMutation<any, Error, FormData>({
    mutationKey: ["UPDATE_PROFILE"],
    mutationFn: async (payload) => await updateProfile(payload),
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(data?.message || "Your profile was not saved.", {
          id: "user-profile-updated",
        });
        return;
      }

      toast.success(data?.message, {
        id: "user-profile-updated",
      });
    },
  });
};

export const useUpdateSocialLinks = () => {
  return useMutation<any, Error, { socialLinks: TSocialLink[] }>({
    mutationKey: ["UPDATE_SOCIAL_LINKS"],
    mutationFn: async (payload) => await updateSocialLinks(payload),
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(data?.message, {
          id: "user-social-links-updated",
        });
      }

      if (data?.success) {
        toast.success(data?.message, {
          id: "user-social-links-updated",
        });
      }
    },
  });
};
