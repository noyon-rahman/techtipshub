import { getDashboardMetrics } from "@/services/metrics";
import { useQuery } from "@tanstack/react-query";

export const useDashboardMetrics = () => {
  return useQuery({
    queryKey: ["DASHBOARD_METRICS"],
    queryFn: async () => await getDashboardMetrics(),
  });
};
