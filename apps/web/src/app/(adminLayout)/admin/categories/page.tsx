"use client";

import CategoriesManager from "@/components/admin/categories-manager";
import AdminPageHeader from "@/components/modules/admin/kit/page-header";
import AdminPageSpinner from "@/components/shared/admin-sidebar/admin-page-spinner";
import { useAdminTitle } from "@/components/shared/admin-sidebar/use-admin-title";
import ButtonLink from "@/components/ui/button-link";
import { Suspense, useState } from "react";
import { FiPlus } from "react-icons/fi";

const CategoriesPage = () => {
  useAdminTitle("Categories");

  const [createRequested, setCreateRequested] = useState(false);

  return (
    <div>
      <AdminPageHeader
        title="Categories"
        description="The topics readers filter the feed by. Each row shows how many published articles use it, so you can see what is in use before you change it."
        actions={
          <ButtonLink
            href="/admin/categories"
            size="sm"
            startContent={<FiPlus aria-hidden />}
            hasPopup
            isExpanded={createRequested}
            onClick={(event) => {
              // The dialog is the destination; the href keeps the control a
              // link for keyboard and middle-click, and is the same page.
              event.preventDefault();
              setCreateRequested(true);
            }}
          >
            New category
          </ButtonLink>
        }
      />
      <Suspense fallback={<AdminPageSpinner label="Loading categories" />}>
        <CategoriesManager
          createRequested={createRequested}
          onCreateRequestedChange={setCreateRequested}
        />
      </Suspense>
    </div>
  );
};

export default CategoriesPage;
