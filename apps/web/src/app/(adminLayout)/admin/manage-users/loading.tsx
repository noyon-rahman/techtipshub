"use client";

import AdminListLoading from "@/components/modules/admin/kit/admin-list-loading";

/** Route fallback: "All members" and "Blocked" chips, search and the card. */
const ManageUsersLoading = () => <AdminListLoading label="members" tabs={2} />;

export default ManageUsersLoading;
