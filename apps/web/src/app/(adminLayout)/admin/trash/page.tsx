"use client";

import TrashManager from "@/components/admin/trash-manager";
import AdminPageHeader from "@/components/modules/admin/kit/page-header";
import AdminPageSpinner from "@/components/shared/admin-sidebar/admin-page-spinner";
import { useAdminTitle } from "@/components/shared/admin-sidebar/use-admin-title";
import ButtonLink from "@/components/ui/button-link";
import { Suspense } from "react";
import { RiArrowLeftLine } from "react-icons/ri";

const TrashPage = () => {
  useAdminTitle("Trash");

  return (
    <div>
      <AdminPageHeader
        title="Trash"
        description="Articles and accounts that were removed but can still come back. A restore does not bring back the comments, views and votes that went with the item."
        actions={
          <ButtonLink
            href="/admin/manage-blogs"
            variant="bordered"
            size="sm"
            startContent={<RiArrowLeftLine aria-hidden />}
          >
            Articles
          </ButtonLink>
        }
      />
      <Suspense fallback={<AdminPageSpinner label="Loading the trash" />}>
        <TrashManager />
      </Suspense>
    </div>
  );
};

export default TrashPage;
