import httpStatus from "http-status";
import type { Context } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import type { TRouteParams } from "../../interface/params";
import sendResponse from "../../utils/sendResponse";
import { userService } from "./user.service";

// get all users (admin only)
const getAllUsers = async (c: Context<TAppBindings>) => {
  const { result, meta } = await userService.getAllUsers(c.req.query());

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

const getSingleUserByUsername = async (c: Context<TAppBindings, string>) => {
  const { username } = c.req.param() as TRouteParams;
  const result = await userService.getSingleUserByUsername(username);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const updateProfile = async (c: Context<TAppBindings>) => {
  const result = await userService.updateProfile(
    c.get("user"),
    c.get("validatedBody"),
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

// update user profile social links
const updateSocialLinks = async (c: Context<TAppBindings>) => {
  const result = await userService.updateSocialLinks(
    c.get("user"),
    c.get("validatedBody"),
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

// block user (only admin)
const blockUser = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await userService.blockUser(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// unblock user (only admin)
const unBlockUser = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await userService.unBlockUser(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// make a user to admin (admin only)
const makeAdmin = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await userService.makeAdmin(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// delete user account (admin only)
const deleteUserAccount = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await userService.deleteUserAccount(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const getDeletedUsers = async (c: Context<TAppBindings>) => {
  const { result, meta } = await userService.getDeletedUsers(c.req.query());

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

const restoreUser = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await userService.restoreUser(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// follow user
const followUser = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams; // user id want's to follow
  const result = await userService.followUser(c.get("user"), id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// unfollow user
const unfollowUser = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams; // user id want's to follow
  const result = await userService.unfollowUser(c.get("user"), id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// get follow status
const getFollowStatus = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams; // user id want's to follow
  const isFollowing = await userService.getFollowStatus(c.get("user"), id);

  return sendResponse(c, httpStatus.OK, { data: { isFollowing } });
};

// get current logged in user followers
const getLoggedInUserFollowers = async (c: Context<TAppBindings>) => {
  const { result, meta } = await userService.getLoggedInUserFollowers(
    c.get("user"),
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

// get current logged in user following
const getLoggedInUserFollowing = async (c: Context<TAppBindings>) => {
  const { result, meta } = await userService.getLoggedInUserFollowing(
    c.get("user"),
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

// get followers by user id
const getFollowersByUserId = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const { result, meta } = await userService.getFollowersByUserId(
    id,
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

// get following by user id
const getFollowingByUserId = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const { result, meta } = await userService.getFollowingByUserId(
    id,
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

export const userController = {
  getAllUsers,
  updateProfile,
  updateSocialLinks,
  blockUser,
  unBlockUser,
  followUser,
  unfollowUser,
  getLoggedInUserFollowers,
  getLoggedInUserFollowing,
  getFollowersByUserId,
  getFollowingByUserId,
  getSingleUserByUsername,
  getFollowStatus,
  makeAdmin,
  deleteUserAccount,
  getDeletedUsers,
  restoreUser,
};
