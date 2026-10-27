"use client";

import CommentsTable from "@/components/admin/comments-table";
import AdminPageHeader from "@/components/modules/admin/kit/page-header";
import AdminPageSpinner from "@/components/shared/admin-sidebar/admin-page-spinner";
import { useAdminTitle } from "@/components/shared/admin-sidebar/use-admin-title";
import ButtonLink from "@/components/ui/button-link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { RiArrowLeftLine } from "react-icons/ri";

/** `?within=24h|7d` seeds the window, so a link from the queue opens on it. */
function CommentsBody() {
  const searchParams = useSearchParams();
  const initialWithin = searchParams.get("within") ?? undefined;

  return <CommentsTable initialWithin={initialWithin} />;
}

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
        <CommentsBody />
      </Suspense>
    </div>
  );
};

export default ManageCommentsPage;
