import httpStatus from "http-status";
import type { Context } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import sendResponse from "../../utils/sendResponse";
import { adminService } from "./admin.service";

const overview = async (c: Context<TAppBindings>) => {
  const result = await adminService.overview();

  return sendResponse(c, httpStatus.OK, { data: result });
};

const search = async (c: Context<TAppBindings>) => {
  const result = await adminService.search(c.req.query("q"));

  return sendResponse(c, httpStatus.OK, { data: result });
};

const activity = async (c: Context<TAppBindings>) => {
  const result = await adminService.activity(c.req.query("days"));

  return sendResponse(c, httpStatus.OK, { data: result });
};

const getLogs = async (c: Context<TAppBindings>) => {
  const { result, meta } = await adminService.getLogs(c.req.query());

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

export const adminController = {
  overview,
  search,
  activity,
  getLogs,
};
