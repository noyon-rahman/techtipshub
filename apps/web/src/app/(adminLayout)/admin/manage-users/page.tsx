"use client";

import AdminPageHeader from "@/components/modules/admin/kit/page-header";
import AdminPageSpinner from "@/components/shared/admin-sidebar/admin-page-spinner";
import { useAdminTitle } from "@/components/shared/admin-sidebar/use-admin-title";
import ButtonLink from "@/components/ui/button-link";
import UsersTable from "@/components/users-table";
import { Suspense } from "react";
import { RiDeleteBinLine } from "react-icons/ri";

const ManageUsersPage = () => {
  useAdminTitle("Members");

  return (
    <div>
      <AdminPageHeader
        title="Members"
        description="Search by name, username or email, filter by role and status, then open a member before changing their account."
        actions={
          <ButtonLink
            href="/admin/trash"
            variant="bordered"
            size="sm"
            startContent={<RiDeleteBinLine aria-hidden />}
          >
            Deleted accounts
          </ButtonLink>
        }
      />
      <Suspense fallback={<AdminPageSpinner label="Loading members" />}>
        <UsersTable />
      </Suspense>
    </div>
  );
};

export default ManageUsersPage;
