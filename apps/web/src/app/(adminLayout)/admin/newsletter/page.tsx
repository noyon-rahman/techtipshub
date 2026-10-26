"use client";

import NewsletterManager from "@/components/admin/newsletter";
import AdminPageHeader from "@/components/modules/admin/kit/page-header";
import { useAdminTitle } from "@/components/shared/admin-sidebar/use-admin-title";

const NewsletterPage = () => {
  useAdminTitle("Newsletter");

  return (
    <div>
      <AdminPageHeader
        title="Newsletter"
        description="The monthly roundup: who receives it, and the issues sent so far. An issue is built from articles the site already has, checked as a test copy, then sent in batches."
      />
      <NewsletterManager />
    </div>
  );
};

export default NewsletterPage;
