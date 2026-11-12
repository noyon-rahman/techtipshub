import httpStatus from "http-status";
import type { Context } from "hono";
import { AppError } from "../../errors";
import type { TAppBindings } from "../../interface/bindings";
import type { TRouteParams } from "../../interface/params";
import sendResponse from "../../utils/sendResponse";
import { commentService } from "../comment/comment.service";

// Admin moderation delete. Unlike the shared route, this always records the
// admin in the audit log.
const deleteComment = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const adminEmail = c.get("user")?.email;

  if (!adminEmail) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized Access");
  }

  const result = await commentService.deleteComment(id, adminEmail);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const getDeletedComments = async (c: Context<TAppBindings>) => {
  const { result } = await commentService.getDeletedComments(c.req.query());

  return sendResponse(c, httpStatus.OK, { data: result });
};

const deleteCommentsPermanently = async (c: Context<TAppBindings>) => {
  const { ids } = c.get("validatedBody") as { ids: string[] };
  const result = await commentService.deleteCommentsPermanently(
    ids,
    c.get("user")?.email,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

export const adminCommentController = {
  deleteComment,
  getDeletedComments,
  deleteCommentsPermanently,
};
