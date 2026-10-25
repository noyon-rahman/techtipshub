import httpStatus from "http-status";
import type { Context } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import type { TRouteParams } from "../../interface/params";
import sendResponse from "../../utils/sendResponse";
import { commentService } from "./comment.service";

const deleteComment = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const user = c.get("user");
  const isAdmin = user?.role === "Admin";

  const result = await commentService.deleteComment(
    id,
    isAdmin ? user.email : undefined,
    isAdmin ? undefined : user?.email,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const updateComment = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await commentService.updateComment(id, c.get("validatedBody"));

  return sendResponse(c, httpStatus.OK, { data: result });
};

const getAll = async (c: Context<TAppBindings>) => {
  const { result, meta } = await commentService.getAll(c.req.query());

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

const getLatest = async (c: Context<TAppBindings>) => {
  const result = await commentService.getLatest(c.req.query("limit"));

  return sendResponse(c, httpStatus.OK, { data: result });
};

const getCounts = async (c: Context<TAppBindings>) => {
  const result = await commentService.getCounts();

  return sendResponse(c, httpStatus.OK, { data: result });
};

export const commentController = {
  deleteComment,
  updateComment,
  getAll,
  getLatest,
  getCounts,
};
