import httpStatus from "http-status";
import type { Context } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import type { TRouteParams } from "../../interface/params";
import sendResponse from "../../utils/sendResponse";
import { blogService } from "./blog.service";

const create = async (c: Context<TAppBindings>) => {
  const result = await blogService.create(c.get("user"), c.get("validatedBody"));

  return sendResponse(c, httpStatus.CREATED, { data: result });
};

const getAll = async (c: Context<TAppBindings>) => {
  const { meta, result } = await blogService.getAll(c.req.query());

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

const getFollowingUsersBlogs = async (c: Context<TAppBindings>) => {
  const { result, meta } = await blogService.getFollowingUsersBlogs(
    c.get("user"),
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

const getLoggedInUserBlogs = async (c: Context<TAppBindings>) => {
  const { meta, result } = await blogService.getLoggedInUserBlogs(
    c.get("user"),
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

// get a single blog by slug.
// Returns the whole article to guests as well; the website decides how much of
// it to show. A signed-in reader also has their view counted.
const getSingleBlog = async (c: Context<TAppBindings, string>) => {
  const slug = c.req.param("slug")!;
  const result = await blogService.getSingleBlog(c.get("user"), slug);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// vote
const voteOnBlog = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const voteType = c.req.query("voteType") as "upvote" | "downvote";

  const result = await blogService.voteOnBlog(c.get("user"), id, voteType);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const getVoteStatus = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const result = await blogService.getVoteStatus(c.get("user"), id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// comment on blog
const commentOnBlog = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const result = await blogService.commentOnBlog(
    c.get("user"),
    id,
    c.get("validatedBody"),
  );

  return sendResponse(c, httpStatus.CREATED, { data: result });
};

// get all comments by blog id
const getAllCommentsByBlogId = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const { result, meta } = await blogService.getAllCommentsByBlogId(
    id,
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

// get all blogs by user id
const getAllBlogsByUserId = async (c: Context<TAppBindings, string>) => {
  const { userId } = c.req.param() as TRouteParams;
  const { result, meta } = await blogService.getAllBlogsByUserId(
    userId,
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

// delete a blog by admin using admin
const deleteBlogByAdminUsingId = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const body = (await c.req.json().catch(() => ({}))) as Record<string, string>;

  const result = await blogService.deleteBlogByAdminUsingId(
    id,
    body,
    c.get("user").email,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

// admin article table: every live article, server-side filtered and paged
const getAdminList = async (c: Context<TAppBindings>) => {
  const { result, meta } = await blogService.getAdminList(c.req.query());

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

const getDeletedBlogs = async (c: Context<TAppBindings>) => {
  const { result, meta } = await blogService.getDeletedBlogs(c.req.query());

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

const restoreBlog = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await blogService.restoreBlog(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// delete blog by user using blog id
const deleteBlogByUserUsingId = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await blogService.deleteBlogByUserUsingId(c.get("user"), id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// update blog by user using blog id
const updateBlogByUserUsingId = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await blogService.updateBlogByUserUsingId(
    c.get("user"),
    id,
    c.get("validatedBody"),
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const updateBlogByAdmin = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await blogService.updateBlogByAdmin(id, c.get("validatedBody"));

  return sendResponse(c, httpStatus.OK, { data: result });
};

export const blogController = {
  create,
  getAll,
  getLoggedInUserBlogs,
  getSingleBlog,
  voteOnBlog,
  commentOnBlog,
  getAllCommentsByBlogId,
  getAllBlogsByUserId,
  getVoteStatus,
  getFollowingUsersBlogs,
  deleteBlogByAdminUsingId,
  deleteBlogByUserUsingId,
  updateBlogByUserUsingId,
  updateBlogByAdmin,
  getAdminList,
  getDeletedBlogs,
  restoreBlog,
};
