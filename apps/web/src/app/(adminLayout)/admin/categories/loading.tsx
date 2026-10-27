"use client";

import AdminListLoading from "@/components/modules/admin/kit/admin-list-loading";

/** Route fallback: "All" and "Unused" chips, search and the card frame. */
const CategoriesLoading = () => (
  <AdminListLoading label="categories" tabs={2} action={false} />
);

export default CategoriesLoading;
