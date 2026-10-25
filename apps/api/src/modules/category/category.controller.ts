import httpStatus from "http-status";
import type { Context } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import type { TRouteParams } from "../../interface/params";
import sendResponse from "../../utils/sendResponse";
import { categoryService } from "./category.service";

const create = async (c: Context<TAppBindings>) => {
  const result = await categoryService.create(
    c.get("validatedBody"),
    c.get("user")?.email,
  );

  return sendResponse(c, httpStatus.CREATED, { data: result });
};

const getAll = async (c: Context<TAppBindings>) => {
  const { meta, result } = await categoryService.getAll(c.req.query());

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

const getSingleCategory = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const result = await categoryService.getSingleCategory(id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const deleteSingleCategory = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const result = await categoryService.deleteSingleCategory(
    id,
    c.get("user")?.email,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const update = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const result = await categoryService.update(
    id,
    c.get("validatedBody"),
    c.get("user")?.email,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const getAdminList = async (c: Context<TAppBindings>) => {
  const { result, total, meta } = await categoryService.getAdminList(
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, {
    data: { result, total },
    meta,
  });
};

export const categoryController = {
  create,
  getAll,
  getSingleCategory,
  deleteSingleCategory,
  update,
  getAdminList,
};
