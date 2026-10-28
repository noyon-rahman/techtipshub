"use server";

import axiosInstance from "@/lib/AxiosInstance";
import { toServiceError } from "./shared";

/** The API caps `limit` at 200; `page` and `sort` are accepted too. */
export const getAdminLogs = async (limit = 100) => {
  try {
    const res = await axiosInstance.get("/admin/logs", { params: { limit } });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The activity log did not load.");
  }
};
