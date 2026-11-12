import httpStatus from "http-status";
import type { Context } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import type { TRouteParams } from "../../interface/params";
import sendResponse from "../../utils/sendResponse";
import { userService } from "./user.service";

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

const updateProfileByAdmin = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await userService.updateProfileByAdmin(
    id,
    c.get("validatedBody"),
    c.get("user").email,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const updateSocialLinks = async (c: Context<TAppBindings>) => {
  const result = await userService.updateSocialLinks(
    c.get("user"),
    c.get("validatedBody"),
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

/** The signed-in reader's own interests, read from their token. */
const getInterests = async (c: Context<TAppBindings>) => {
  const result = await userService.getInterests(c.get("user"));

  return sendResponse(c, httpStatus.OK, { data: result });
};

const updateInterests = async (c: Context<TAppBindings>) => {
  const { interests } = c.get("validatedBody") as { interests: string[] };
  const result = await userService.updateInterests(c.get("user"), interests);

  return sendResponse(c, httpStatus.OK, { data: result });
};

/** The username step: the handle to offer, and whether it still applies. */
const readUsernameOnboarding = async (c: Context<TAppBindings>) => {
  const result = await userService.readUsernameOnboarding(c.get("user"));

  return sendResponse(c, httpStatus.OK, { data: result });
};

/** `?username=` while it is typed: available, or the sentence saying why not. */
const checkUsernameAvailability = async (c: Context<TAppBindings>) => {
  const { username } = c.get("validatedQuery") as { username: string };
  const result = await userService.checkUsernameAvailability(
    c.get("user"),
    username,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const completeUsernameOnboarding = async (c: Context<TAppBindings>) => {
  const { username } = c.get("validatedBody") as { username: string };
  const result = await userService.completeUsernameOnboarding(
    c.get("user"),
    username,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

/** The lock as this member stands under it, for the profile's handle field. */
const getUsernameState = async (c: Context<TAppBindings>) => {
  const result = await userService.getUsernameState(c.get("user"));

  return sendResponse(c, httpStatus.OK, { data: result });
};

/**
 * Where an old handle points now, open to anyone.
 *
 * Public because the caller is a crawler following a link from a search
 * result: it has no session, and the redirect is the whole reason the row
 * exists. `data: null` means the handle was never held by anyone.
 */
const findCurrentHandle = async (c: Context<TAppBindings, string>) => {
  const { handle } = c.req.param() as TRouteParams;
  const result = await userService.findCurrentHandle(handle);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const blockUser = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await userService.blockUser(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const unBlockUser = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await userService.unBlockUser(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const makeAdmin = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await userService.makeAdmin(id, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const resendVerificationEmail = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await userService.resendVerificationEmail(
    id,
    c.get("user").email,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

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

const deleteUserAccountPermanently = async (
  c: Context<TAppBindings, string>,
) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await userService.deleteUserAccountPermanently(
    id,
    c.get("user").email,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const deleteUsersInBulk = async (c: Context<TAppBindings>) => {
  const { ids } = c.get("validatedBody") as { ids: string[] };
  const result = await userService.deleteUsersInBulk(ids, c.get("user").email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const deleteUsersPermanently = async (c: Context<TAppBindings>) => {
  const { ids } = c.get("validatedBody") as { ids: string[] };
  const result = await userService.deleteUsersPermanently(
    ids,
    c.get("user").email,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const followUser = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams; // user id want's to follow
  const result = await userService.followUser(c.get("user"), id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const unfollowUser = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams; // user id want's to follow
  const result = await userService.unfollowUser(c.get("user"), id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const getFollowStatus = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams; // user id want's to follow
  const result = await userService.getFollowStatus(c.get("user"), id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const getLoggedInUserFollowers = async (c: Context<TAppBindings>) => {
  const { result, meta } = await userService.getLoggedInUserFollowers(
    c.get("user"),
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

const getLoggedInUserFollowing = async (c: Context<TAppBindings>) => {
  const { result, meta } = await userService.getLoggedInUserFollowing(
    c.get("user"),
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

const getFollowersByUserId = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const { result, meta } = await userService.getFollowersByUserId(
    id,
    c.req.query(),
  );

  return sendResponse(c, httpStatus.OK, { data: result, meta });
};

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
  updateProfileByAdmin,
  updateSocialLinks,
  getInterests,
  updateInterests,
  readUsernameOnboarding,
  checkUsernameAvailability,
  completeUsernameOnboarding,
  getUsernameState,
  findCurrentHandle,
  blockUser,
  unBlockUser,
  resendVerificationEmail,
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
  deleteUserAccountPermanently,
  deleteUsersInBulk,
  deleteUsersPermanently,
};
