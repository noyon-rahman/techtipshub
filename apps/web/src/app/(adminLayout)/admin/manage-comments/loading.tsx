"use client";

import AdminListLoading from "@/components/modules/admin/kit/admin-list-loading";

/** Route fallback: the three window chips, search and the card frame. */
const ManageCommentsLoading = () => (
  <AdminListLoading label="comments" tabs={3} />
);

export default ManageCommentsLoading;
