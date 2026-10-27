"use client";

import BlogsTable from "@/components/blogs-table";
import AdminPageHeader from "@/components/modules/admin/kit/page-header";
import AdminPageSpinner from "@/components/shared/admin-sidebar/admin-page-spinner";
import { useAdminTitle } from "@/components/shared/admin-sidebar/use-admin-title";
import ButtonLink from "@/components/ui/button-link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { FiPlus } from "react-icons/fi";
import { adminNewBlogPath } from "@/lib/blog-routes";

/** `?sort=` seeds the table's starting tab, read verbatim. */
function ManageBlogsTable() {
  const searchParams = useSearchParams();
  const initialSort = searchParams.get("sort") ?? undefined;

  return <BlogsTable initialSort={initialSort} />;
}

const ManageBlogsPage = () => {
  useAdminTitle("Articles");

  return (
    <div>
      <AdminPageHeader
        title="Articles"
        description="Every article, newest first. Open one to read it, jump to the editor, or remove it with a reason. Drafts are articles written for a member but not published yet. Removed articles move to Trash, where you can restore them or delete them for good."
        actions={
          <ButtonLink
            href={adminNewBlogPath}
            size="sm"
            startContent={<FiPlus aria-hidden />}
          >
            Write an article
          </ButtonLink>
        }
      />
      <Suspense fallback={<AdminPageSpinner label="Loading articles" />}>
        <ManageBlogsTable />
      </Suspense>
    </div>
  );
};

export default ManageBlogsPage;
