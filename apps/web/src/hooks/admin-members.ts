"use client";

/**
 * Member hooks.
 *
 * useAdminMembers({ page?, limit?, searchTerm?, sort?, role?, status? })
 *   -> { data: <API envelope>, rows: IUser[], meta, isLoading, isFetching,
 *        isError, refetch }
 *      reads `GET /admin/users`. `role` is "User" | "Admin", `status` is
 *      "Active" | "Blocked"; leave either out for all.
 *
 * useTrashedUsers in `admin-trash.ts` covers the deleted members.
 * useFoundMember(id), useMemberFollowers(id), useMemberFollowing(id) read a
 * single member and the two follow lists.
 *
 * useUpdateMemberProfile() saves the profile editor's multipart body and
 * refreshes the member row plus every list that shows it.
 */
import { publicProfilePath } from "@/lib/blog-routes";
import {
  getAdminMember,
  getAdminUsers,
  getMemberFollowers,
  getMemberFollowing,
  readMemberPage,
  updateMemberProfile,
} from "@/services/admin/members";
import type { IAdminMembersParams } from "@/types/admin.type";
import type { IFollower, IUser } from "@/types";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import { toast } from "sonner";
import {
  keepPreviousData,
  toAdminList,
  type IAdminList,
  type IAdminListResult,
} from "./admin-list";

/** Rows shown per follow list; the card says how many more there are. */
export const MEMBER_PEOPLE_LIMIT = 6;

export const ADMIN_MEMBERS_KEY = ["ADMIN_MEMBERS"] as const;

export type TAdminMembersParams = IAdminMembersParams;

export const useAdminMembers = (
  params: TAdminMembersParams = {},
): IAdminList<IUser, IAdminListResult<IUser>> => {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;

  const query = useQuery({
    queryKey: [
      ...ADMIN_MEMBERS_KEY,
      page,
      limit,
      params.searchTerm ?? "",
      params.sort ?? "",
      params.role ?? "",
      params.status ?? "",
    ],
    queryFn: async () => {
      const payload = await getAdminUsers({
        page,
        limit,
        searchTerm: params.searchTerm || undefined,
        sort: params.sort || undefined,
        role: params.role,
        status: params.status,
      });
      const { rows, meta } = readMemberPage(payload, { page, limit });

      return { rows, meta, raw: payload };
    },
    placeholderData: keepPreviousData,
  });

  return toAdminList(query);
};

interface IListEnvelope<T> {
  success?: boolean;
  data?: T[];
  meta?: { total?: number };
}

const readRows = <T>(response: unknown): { rows: T[]; total?: number } => {
  const payload = response as IListEnvelope<T> | undefined;
  if (!payload || payload.success === false || !Array.isArray(payload.data)) {
    return { rows: [] };
  }

  return { rows: payload.data, total: payload.meta?.total };
};

export type TPersonRow = Pick<
  IFollower,
  "_id" | "fullName" | "username" | "profilePicture"
>;

export interface IPeoplePage {
  rows: TPersonRow[];
  total?: number;
}

/**
 * The member behind a route id.
 *
 * Reads `GET /admin/users/:id`, so the screen opens any member, not only the
 * ten on the list's first page. A 404 is "no such member" and settles as a
 * success with no data; the screen shows the not-found state for that and its
 * error state for everything else.
 */
export const useFoundMember = (memberId?: string) => {
  const query = useQuery({
    queryKey: ["ADMIN_MEMBER", memberId],
    queryFn: async (): Promise<IUser | undefined> =>
      await getAdminMember(memberId!),
    enabled: Boolean(memberId),
    staleTime: 30_000,
  });

  return {
    member: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    isMissing: query.isSuccess && query.data === undefined,
    refetch: query.refetch,
  };
};

export const useMemberFollowers = (
  memberId?: string,
): UseQueryResult<IPeoplePage> =>
  useQuery({
    queryKey: ["ADMIN_MEMBER_FOLLOWERS", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { rows, total } = readRows<{ follower?: TPersonRow }>(
        await getMemberFollowers(memberId!, {
          page: 1,
          limit: MEMBER_PEOPLE_LIMIT,
        }),
      );
      return { rows: rows.flatMap((row) => row.follower ?? []), total };
    },
  });

export const useMemberFollowing = (
  memberId?: string,
): UseQueryResult<IPeoplePage> =>
  useQuery({
    queryKey: ["ADMIN_MEMBER_FOLLOWING", memberId],
    enabled: Boolean(memberId),
    queryFn: async () => {
      const { rows, total } = readRows<{ following?: TPersonRow }>(
        await getMemberFollowing(memberId!, {
          page: 1,
          limit: MEMBER_PEOPLE_LIMIT,
        }),
      );
      return { rows: rows.flatMap((row) => row.following ?? []), total };
    },
  });

/** Where a member's public profile lives, once they have a username. */
export const memberProfileHref = (username?: string) =>
  username ? publicProfilePath(username) : undefined;

/**
 * Saves a member profile from the admin screen.
 *
 * The row itself is cached under the member-detail key as well as the list
 * keys, so all four are refreshed: the detail screen reads the member, and the
 * tables read their own lists.
 */
export const useUpdateMemberProfile = () => {
  const queryClient = useQueryClient();

  return useMutation<any, Error, { id: string; payload: FormData }>({
    mutationKey: ["ADMIN_UPDATE_MEMBER"],
    mutationFn: async ({ id, payload }) =>
      await updateMemberProfile(id, payload),
    onSuccess: (_data, variables) => {
      toast.success("Profile saved", { id: "admin-update-member" });
      queryClient.invalidateQueries({
        queryKey: ["ADMIN_MEMBER", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_MEMBERS_KEY });
      queryClient.invalidateQueries({ queryKey: ["GET_ALL_USERS"] });
      queryClient.invalidateQueries({ queryKey: ["TRASHED_USERS"] });
    },
    onError: (error) => {
      toast.error(error?.message || "The profile could not be saved.", {
        id: "admin-update-member",
      });
    },
  });
};
