"use client";

import type { ReactNode } from "react";
import AdminPageHeader from "@/components/modules/admin/kit/page-header";

interface IProps {
  title: string;
  /** One-line explanation of what this screen is for. */
  description?: string;
  /** Buttons or links aligned to the right of the heading. */
  action?: ReactNode;
  /** Same as `action`, for callers that pass several controls. */
  actions?: ReactNode;
  /** Small inline facts under the title, e.g. counts. */
  meta?: ReactNode;
}

/** Heading block for admin screens, on top of the kit header. */
const DashboardTitle = ({
  title,
  description,
  action,
  actions,
  meta,
}: IProps) => (
  <AdminPageHeader
    title={title}
    description={description}
    actions={actions ?? action}
    meta={meta}
  />
);

export default DashboardTitle;
