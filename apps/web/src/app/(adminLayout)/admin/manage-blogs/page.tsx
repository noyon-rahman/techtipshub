"use client";

import BlogsTable from "@/components/blogs-table";
import AdminPageHeader from "@/components/modules/admin/kit/page-header";
import AdminPageSpinner from "@/components/shared/admin-sidebar/admin-page-spinner";
import { useAdminTitle } from "@/components/shared/admin-sidebar/use-admin-title";
import ButtonLink from "@/components/ui/button-link";
import { Suspense } from "react";
import { FiPlus } from "react-icons/fi";
import { adminNewBlogPath } from "@/lib/blog-routes";

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
        <BlogsTable />
      </Suspense>
    </div>
  );
};

export default ManageBlogsPage;
