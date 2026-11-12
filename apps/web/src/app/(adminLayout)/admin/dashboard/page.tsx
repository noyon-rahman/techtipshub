"use client";

import DashboardContent from "@/components/modules/admin/dashboard";
import AdminPageHeader from "@/components/modules/admin/kit/page-header";
import { useAdminTitle } from "@/components/shared/admin-sidebar/use-admin-title";
import { useUser } from "@/context/user.provider";

const greetingForHour = (hour: number) => {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const AdminDashboard = () => {
  useAdminTitle("Admin");
  const { user } = useUser();

  const firstName = user?.name?.trim().split(/\s+/)[0];
  const title = firstName
    ? `${greetingForHour(new Date().getHours())}, ${firstName}`
    : "Dashboard";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div>
      <AdminPageHeader
        showHeading
        title={title}
        description={`${today} · TechTipsHub Admin · Overview of the last 7 days`}
      />
      <DashboardContent />
    </div>
  );
};

export default AdminDashboard;
