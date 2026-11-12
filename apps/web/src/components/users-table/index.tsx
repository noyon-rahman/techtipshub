"use client";

import {
  ListSelect,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZES,
  useDebouncedTerm,
} from "@/components/admin/list-controls";
import { formatCount, formatDate } from "@/components/admin/format";
import ConfirmDialog from "@/components/modules/admin/kit/confirm-dialog";
import DataTable, {
  type DataTableColumn,
} from "@/components/modules/admin/kit/data-table";
import DataToolbar from "@/components/modules/admin/kit/data-toolbar";
import EmptyState from "@/components/modules/admin/kit/empty-state";
import ListFooter from "@/components/modules/admin/kit/list-footer";
import ListFrame from "@/components/modules/admin/kit/list-frame";
import SelectionBar from "@/components/modules/admin/kit/selection-bar";
import { focusRing } from "@/components/modules/admin/kit/tau";
import useRowSelection from "@/components/modules/admin/kit/use-row-selection";
import { publicProfilePath } from "@/lib/blog-routes";
import StatusPill from "@/components/ui/status-pill";
import { useAdminMembers } from "@/hooks/admin-members";
import { listParam, useAdminListParams } from "@/hooks/use-admin-list-params";
import {
  useBlockUser,
  useDeleteUserAccount,
  useDeleteUsersInBulk,
  useMakeAdmin,
  useResendVerificationEmail,
  useUnblockUser,
} from "@/hooks/user.hook";
import type { IUser } from "@/types";
import UserAvatar from "@/components/ui/user-avatar";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FiExternalLink,
  FiMail,
  FiSearch,
  FiSlash,
  FiTrash2,
  FiUserCheck,
} from "react-icons/fi";
import { PiUsers } from "react-icons/pi";
import RowMenu from "./row-menu";

/**
 * The values `GET /admin/users` accepts, plus `all` for "no filter" (see
 * `parseEnumParam` in the API's `user.service.ts`, which also normalises case).
 * Both the status tabs and the role select send the value as stored.
 */
const MEMBERS_LIST = {
  status: listParam({
    values: ["all", "Active", "Blocked"] as const,
    default: "all",
    resetsPage: true,
  }),
  role: listParam({
    values: ["all", "User", "Admin"] as const,
    default: "all",
    resetsPage: true,
  }),
  searchTerm: listParam({ default: "", resetsPage: true }),
  page: listParam({ default: 1 }),
  limit: listParam({
    default: PAGE_SIZES[0],
    allowed: PAGE_SIZES,
    resetsPage: true,
  }),
} as const;

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All roles" },
  { value: "User", label: "Members" },
  { value: "Admin", label: "Admins" },
];

/** The two status tabs, which are labels for the schema's status values. */
const isStatusTab = (value: string): value is "all" | "blocked" =>
  value === "all" || value === "blocked";

const displayName = (user: IUser) =>
  user.fullName?.trim() || user.username || "Unnamed member";

const COLUMNS: DataTableColumn[] = [
  { key: "member", header: "Member", className: "min-w-[16rem]" },
  { key: "role", header: "Role", className: "whitespace-nowrap" },
  { key: "status", header: "Status", className: "whitespace-nowrap" },
  {
    key: "followers",
    header: "Followers",
    align: "right",
    className: "whitespace-nowrap tabular-nums",
  },
  {
    key: "joined",
    header: "Joined",
    className: "whitespace-nowrap tabular-nums",
  },
  { key: "actions", header: "Actions", align: "right" },
];

const quietButton = `inline-flex min-h-11 items-center rounded-[6px] border border-default-300 px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-default-100 sm:min-h-9 ${focusRing}`;

const menuItem = `flex min-h-11 w-full items-center gap-2 rounded-[5px] px-2.5 text-left text-sm text-foreground transition-colors hover:bg-default-100 focus-visible:bg-default-100 disabled:pointer-events-none disabled:text-default-400 ${focusRing}`;

const dangerItem = `flex min-h-11 w-full items-center gap-2 rounded-[5px] px-2.5 text-left text-sm text-danger transition-colors hover:bg-danger/10 focus-visible:bg-danger/10 disabled:pointer-events-none disabled:text-default-400 ${focusRing}`;

const MenuItemLink = ({
  href,
  children,
  external = false,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) => (
  <Link
    href={href}
    role="menuitem"
    target={external ? "_blank" : undefined}
    rel={external ? "noreferrer" : undefined}
    className={menuItem}
  >
    {children}
  </Link>
);

const MenuSeparator = () => (
  <div role="separator" className="my-1 h-px bg-default/60" />
);

/**
 * Member management. Search, role, status, page size and page go to
 * `GET /admin/users`, so the footer total and the pager cover every account
 * rather than the rows that were fetched.
 *
 * "Blocked" is a tab and not a status select: it is the one account state an
 * admin acts on, and the dashboard links straight to it. The status column
 * still says which accounts are active, and which are unverified.
 *
 * Every one of those is in the URL, so a reload or a bookmark returns the same
 * tab, page and search.
 */
const UsersTable = () => {
  const filters = useAdminListParams(MEMBERS_LIST);
  const { status, role, page, limit } = filters.values;
  const [query, setQuery] = useState(filters.values.searchTerm);

  // Settling a search reads the latest setter without restarting the timer.
  const setFiltersRef = useRef(filters.set);
  useEffect(() => {
    setFiltersRef.current = filters.set;
  }, [filters.set]);
  useDebouncedTerm(
    query,
    useCallback((searchTerm: string) => {
      setFiltersRef.current({ searchTerm });
    }, []),
  );

  const searchTerm = filters.values.searchTerm;

  const list = useAdminMembers({
    page,
    limit,
    searchTerm,
    role: role === "all" ? undefined : role,
    status: status === "all" ? undefined : status,
  });

  const { mutate: blockUser, isPending: isBlocking } = useBlockUser();
  const { mutate: unblockUser, isPending: isUnblocking } = useUnblockUser();
  const { mutate: makeAdmin, isPending: isPromoting } = useMakeAdmin();
  const { mutate: resendVerification, isPending: isResendingVerification } =
    useResendVerificationEmail();
  const { mutate: deleteAccount, isPending: isDeleting } =
    useDeleteUserAccount();
  const { mutate: deleteUsersInBulk, isPending: isDeletingInBulk } =
    useDeleteUsersInBulk();

  const { rows, meta, isLoading, isError, error, refetch } = list;

  // An admin account cannot be deleted, so it cannot be picked: "select all"
  // means every member on the page who can go to the trash.
  const selection = useRowSelection({
    rows,
    getKey: (user) => user._id,
    selectable: (user) => user.role !== "Admin",
    resetWith: `${status}:${role}:${searchTerm}:${page}`,
    selectAllLabel: "Select every member on this page",
  });

  const totalPages = Math.max(meta?.totalPages ?? 1, 1);
  const pageSize = meta?.limit ?? limit;

  const refresh = () => {
    void refetch();
  };

  // Emptying the last row of a page leaves the reader on a page the list no
  // longer has, so step back one. Nothing moves on page 1.
  const onDeleted = useCallback(() => {
    if (page > 1 && rows.length <= 1) filters.set({ page: page - 1 });
  }, [filters, page, rows.length]);

  const changeTab = (next: "all" | "blocked") =>
    filters.set({ status: next === "blocked" ? "Blocked" : "all" });

  const tabs = [
    {
      key: "all",
      label: "All members",
      count: status === "all" ? meta?.total : undefined,
    },
    { key: "blocked", label: "Blocked" },
  ];

  const isFiltered = Boolean(searchTerm) || role !== "all";

  const resetFilters = () => {
    setQuery("");
    filters.set({ role: "all", searchTerm: "" });
  };

  const emptyState = isError ? (
    <EmptyState
      variant="inline"
      icon={<PiUsers className="size-5" />}
      title="Members could not be loaded"
      description={
        error?.message ||
        "The members request failed. Check that the API is running, then try again."
      }
      action={
        <button type="button" onClick={refresh} className={quietButton}>
          Try again
        </button>
      }
    />
  ) : status === "Blocked" ? (
    <EmptyState
      variant="inline"
      icon={<PiUsers className="size-5" />}
      title="No blocked accounts"
      description="Accounts you block land here so you can find them again and unblock them."
      action={
        <button
          type="button"
          onClick={() => changeTab("all")}
          className={quietButton}
        >
          Show all members
        </button>
      }
    />
  ) : isFiltered ? (
    <EmptyState
      variant="inline"
      icon={<FiSearch className="size-5" />}
      title="No members match this view"
      description="No account on the server matches that search and role. Clear them to see every member."
      action={
        <button type="button" onClick={resetFilters} className={quietButton}>
          Clear search and filters
        </button>
      }
    />
  ) : (
    <EmptyState
      variant="inline"
      icon={<PiUsers className="size-5" />}
      title="No members yet"
      description="Accounts appear here as people join. Roles, block status and join dates are managed from this table."
    />
  );

  return (
    <ListFrame label="Member accounts">
      <DataToolbar
        filters={tabs}
        activeFilter={status === "Blocked" ? "blocked" : "all"}
        onFilterChange={(key) => {
          if (isStatusTab(key))
            changeTab(key === "blocked" ? "blocked" : "all");
        }}
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Name, username or email"
        right={
          <>
            <ListSelect
              label="Role"
              hideLabel
              value={role}
              onChange={(value) => {
                if (value === "User" || value === "Admin" || value === "all")
                  filters.set({ role: value });
              }}
              options={ROLE_OPTIONS}
            />
            <ListSelect
              label="Per page"
              hideLabel
              value={limit}
              onChange={(value) => filters.set({ limit: Number(value) })}
              options={PAGE_SIZE_OPTIONS}
            />
          </>
        }
      />

      <SelectionBar
        count={selection.count}
        noun="member"
        onClear={selection.clear}
      >
        <ConfirmDialog
          trigger={
            <button
              type="button"
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-[6px] border border-danger/40 px-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10 sm:min-h-9 ${focusRing}`}
            >
              <FiTrash2 aria-hidden className="size-4" />
              Move to Trash
            </button>
          }
          title={`Move ${selection.count} ${
            selection.count === 1 ? "member" : "members"
          } to the trash?`}
          description="Their articles, comments, views and votes are removed with them, as they are for a single delete. Trash restores the login and profile, not that history."
          confirmLabel="Move to Trash"
          isPending={isDeletingInBulk}
          onConfirm={() =>
            deleteUsersInBulk(selection.keys, {
              onSuccess: () => {
                const leaving = selection.count;
                selection.clear();
                if (page > 1 && rows.length <= leaving) {
                  filters.set({ page: page - 1 });
                }
              },
            })
          }
        />
      </SelectionBar>

      <DataTable
        caption="Member accounts, newest first"
        columns={COLUMNS}
        rows={rows}
        getRowKey={(user) => user._id}
        isLoading={isLoading}
        selection={selection}
        rowLabel={(user) => `Select ${displayName(user)}`}
        skeletonRows={Math.min(limit, 10)}
        emptyState={emptyState}
        minWidth="54rem"
        renderCell={(user, key) => {
          switch (key) {
            case "member": {
              const name = displayName(user);
              return (
                <div className="flex min-w-0 items-center gap-2.5">
                  <UserAvatar
                    src={user.profilePicture || undefined}
                    size="sm"
                    className="size-8 shrink-0"
                    classNames={{ name: "text-xs" }}
                    name={name.charAt(0).toUpperCase()}
                  />
                  <div className="min-w-0">
                    <Link
                      href={`/admin/manage-users/${user._id}`}
                      className={`block max-w-[18rem] truncate rounded-sm font-medium hover:text-primary-accessible ${focusRing}`}
                    >
                      {name}
                    </Link>
                    <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-default-600">
                      {user.email && (
                        <span className="max-w-[15rem] truncate">
                          {user.email}
                        </span>
                      )}
                      {user.username && <span>@{user.username}</span>}
                    </div>
                  </div>
                </div>
              );
            }

            case "role":
              return (
                <StatusPill
                  tone={user.role === "Admin" ? "primary" : "neutral"}
                >
                  {user.role === "Admin" ? "Admin" : "Member"}
                </StatusPill>
              );

            case "status":
              return (
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusPill
                    tone={user.status === "Active" ? "success" : "danger"}
                    dot
                  >
                    {user.status}
                  </StatusPill>
                  {user.isVerified ? (
                    <StatusPill tone="neutral">Verified</StatusPill>
                  ) : (
                    <StatusPill tone="warning">Unverified</StatusPill>
                  )}
                </div>
              );

            case "followers":
              return <span>{formatCount(user.totalFollowers) || "0"}</span>;

            case "joined":
              return (
                <span className="text-xs text-default-600">
                  {formatDate(user.createdAt) || "Not recorded"}
                </span>
              );

            case "actions": {
              const name = displayName(user);
              const isAdmin = user.role === "Admin";
              const blocked = user.status === "Blocked";

              return (
                <RowMenu label={`Actions for ${name}`}>
                  <MenuItemLink href={`/admin/manage-users/${user._id}`}>
                    Open member
                  </MenuItemLink>
                  {user.username && (
                    <MenuItemLink
                      href={publicProfilePath(user.username)}
                      external
                    >
                      <FiExternalLink aria-hidden className="size-4" />
                      Public profile
                    </MenuItemLink>
                  )}

                  <MenuSeparator />

                  {!user.isVerified && (
                    <ConfirmDialog
                      trigger={
                        <button
                          type="button"
                          role="menuitem"
                          disabled={blocked}
                          className={menuItem}
                          title={
                            blocked
                              ? "Unblock them before sending verification"
                              : undefined
                          }
                        >
                          <FiMail aria-hidden className="size-4" />
                          Resend verification
                        </button>
                      }
                      title={`Resend verification email to ${name}?`}
                      description={
                        user.email
                          ? `Sends a fresh verification link to ${user.email}.`
                          : "Sends a fresh verification link to this member's email address."
                      }
                      confirmLabel="Send verification"
                      isPending={isResendingVerification}
                      onConfirm={() => resendVerification(user._id)}
                    />
                  )}

                  {blocked ? (
                    <ConfirmDialog
                      trigger={
                        <button
                          type="button"
                          role="menuitem"
                          className={menuItem}
                        >
                          <FiSlash aria-hidden className="size-4" />
                          Unblock account
                        </button>
                      }
                      title={`Unblock ${name}?`}
                      description="They can sign in, vote and comment again straight away."
                      confirmLabel="Unblock account"
                      isPending={isUnblocking}
                      onConfirm={() =>
                        unblockUser(user._id, { onSuccess: () => refresh() })
                      }
                    />
                  ) : (
                    <ConfirmDialog
                      trigger={
                        <button
                          type="button"
                          role="menuitem"
                          disabled={isAdmin}
                          className={menuItem}
                          title={
                            isAdmin
                              ? "Admin accounts cannot be blocked"
                              : undefined
                          }
                        >
                          <FiSlash aria-hidden className="size-4" />
                          Block account
                        </button>
                      }
                      title={`Block ${name}?`}
                      description="They stay visible on the site but cannot sign in, comment or vote until you unblock them."
                      confirmLabel="Block account"
                      tone="danger"
                      isPending={isBlocking}
                      onConfirm={() =>
                        blockUser(user._id, { onSuccess: () => refresh() })
                      }
                    />
                  )}

                  {isAdmin ? (
                    <span
                      role="menuitem"
                      aria-disabled="true"
                      className={`${menuItem} text-default-400`}
                    >
                      <FiUserCheck aria-hidden className="size-4" />
                      Already an admin
                    </span>
                  ) : (
                    <ConfirmDialog
                      trigger={
                        <button
                          type="button"
                          role="menuitem"
                          disabled={blocked}
                          className={menuItem}
                          title={
                            blocked
                              ? "Unblock them before promoting"
                              : undefined
                          }
                        >
                          <FiUserCheck aria-hidden className="size-4" />
                          Make admin
                        </button>
                      }
                      title={`Make ${name} an admin?`}
                      description="Admins can manage articles, comments, members and settings. This screen cannot undo it."
                      confirmLabel="Make admin"
                      isPending={isPromoting}
                      onConfirm={() =>
                        makeAdmin(user._id, { onSuccess: () => refresh() })
                      }
                    />
                  )}

                  <MenuSeparator />

                  <ConfirmDialog
                    trigger={
                      <button
                        type="button"
                        role="menuitem"
                        disabled={isAdmin}
                        className={dangerItem}
                        title={
                          isAdmin
                            ? "Admin accounts cannot be deleted"
                            : undefined
                        }
                      >
                        <FiTrash2 aria-hidden className="size-4" />
                        Delete account
                      </button>
                    }
                    title={`Delete ${name}'s account?`}
                    description="Their articles, comments, views and votes go with the account. The login moves to Trash, where it can be restored or deleted for good."
                    confirmLabel="Delete account"
                    tone="danger"
                    isPending={isDeleting}
                    onConfirm={() =>
                      deleteAccount(user._id, {
                        onSuccess: () => {
                          onDeleted();
                          refresh();
                        },
                      })
                    }
                  />
                </RowMenu>
              );
            }

            default:
              return null;
          }
        }}
      />

      <ListFooter
        total={meta?.total}
        shown={rows.length}
        noun="account"
        page={meta?.page ?? page}
        totalPages={totalPages}
        pageSize={pageSize}
        onPageChange={(next) => filters.set({ page: Math.max(1, next) })}
        isLoading={isLoading && !meta}
        isError={isError}
        context={
          [
            status === "Blocked" ? ", blocked only" : "",
            role === "all"
              ? ""
              : role === "Admin"
                ? ", admins only"
                : ", members only",
            searchTerm ? `, matching "${searchTerm}"` : "",
          ].join("") || null
        }
      />
    </ListFrame>
  );
};

export default UsersTable;
