import { getAdminLogs } from "@/services/admin/activity";
import { useQuery } from "@tanstack/react-query";

/**
 * The admin log.
 *
 * `GET /admin/logs?limit=` returns a paged, newest-first list; the screen takes
 * two batches so a full screen of rows does not cost a second request, and
 * narrows what it received. The query key carries `limit`; a failed request
 * leaves the screen free to show `isError` instead of an empty log.
 */
export const useAdminLogs = (limit = 100) => {
  return useQuery({
    queryKey: ["ADMIN_LOGS", limit],
    queryFn: async () => await getAdminLogs(limit),
  });
};
