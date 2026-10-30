"use client";

import CommentsTable from "@/components/admin/comments-table";
import AdminPageHeader from "@/components/modules/admin/kit/page-header";
import AdminPageSpinner from "@/components/shared/admin-sidebar/admin-page-spinner";
import { useAdminTitle } from "@/components/shared/admin-sidebar/use-admin-title";
import ButtonLink from "@/components/ui/button-link";
import { Suspense } from "react";
import { RiArrowLeftLine } from "react-icons/ri";

const ManageCommentsPage = () => {
  useAdminTitle("Comments");

  return (
    <div>
      <AdminPageHeader
        title="Comments"
        description="Every comment across the site, newest first. Read one in full before you decide, and remember that a deletion cannot be undone."
        actions={
          <ButtonLink
            href="/admin/moderation"
            variant="bordered"
            size="sm"
            startContent={<RiArrowLeftLine aria-hidden />}
          >
            Back to moderation
          </ButtonLink>
        }
      />
      <Suspense fallback={<AdminPageSpinner label="Loading comments" />}>
        <CommentsTable />
      </Suspense>
    </div>
  );
};

export default ManageCommentsPage;
