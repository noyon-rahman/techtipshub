import httpStatus from "http-status";
import type { Context } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import sendResponse from "../../utils/sendResponse";
import { metricsService } from "./metrics.service";

const dashboard = async (c: Context<TAppBindings>) => {
  const result = await metricsService.dashboard();

  return sendResponse(c, httpStatus.OK, { data: result });
};

export const metricsController = {
  dashboard,
};
