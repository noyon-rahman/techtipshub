import httpStatus from "http-status";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import config from "../../config";
import { AppError } from "../../errors";
import type { TAppBindings } from "../../interface/bindings";
import sendResponse from "../../utils/sendResponse";
import { authService } from "./auth.service";

/**
 * The refresh token as an httpOnly cookie.
 *
 * The browser never reads it; it is only sent back on `/auth/refresh-token`.
 * `sameSite` is set explicitly because Hono, unlike Express, does not add a
 * default one.
 */
const setRefreshCookie = (c: Context<TAppBindings>, refreshToken: string) => {
  setCookie(c, "refreshToken", refreshToken, {
    secure: config.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 60 * 365,
  });
};

const register = async (c: Context<TAppBindings>) => {
  const result = await authService.register(c.get("validatedBody"));

  return sendResponse(c, httpStatus.CREATED, { data: result });
};

const login = async (c: Context<TAppBindings>) => {
  const { accessToken, refreshToken } = await authService.login(
    c.get("validatedBody"),
  );

  setRefreshCookie(c, refreshToken);

  return sendResponse(c, httpStatus.OK, { data: { accessToken, refreshToken } });
};

const socialLogin = async (c: Context<TAppBindings>) => {
  const { accessToken, refreshToken } = await authService.socialLogin(
    c.get("validatedBody"),
  );

  setRefreshCookie(c, refreshToken);

  return sendResponse(c, httpStatus.OK, { data: { accessToken, refreshToken } });
};

// get me (current logged in user)
const getMe = async (c: Context<TAppBindings>) => {
  const user = await authService.getMe(c.get("user"));

  return sendResponse(c, httpStatus.OK, { data: user });
};

// change password (current logged in user)
const changePassword = async (c: Context<TAppBindings>) => {
  const result = await authService.changePassword(
    c.get("user"),
    c.get("validatedBody"),
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

// forget password
const forgetPassword = async (c: Context<TAppBindings>) => {
  const { email } = c.get("validatedBody") as { email: string };
  const result = await authService.forgetPassword(email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// reset password
const resetPassword = async (c: Context<TAppBindings>) => {
  const token = c.req.header("authorization")?.split(" ")[1];

  if (!token) {
    throw new AppError(httpStatus.FORBIDDEN, "Access Forbidden");
  }

  const result = await authService.resetPassword(c.get("validatedBody"), token);

  return sendResponse(c, httpStatus.OK, { data: result });
};

// generate access token via refresh token
const generateNewAccessToken = async (c: Context<TAppBindings>) => {
  const { refreshToken } = c.get("validatedCookies") as {
    refreshToken: string;
  };

  const newAccessToken = await authService.generateNewAccessToken(refreshToken);

  return sendResponse(c, httpStatus.OK, { data: { accessToken: newAccessToken } });
};

export const authController = {
  register,
  login,
  socialLogin,
  getMe,
  changePassword,
  forgetPassword,
  resetPassword,
  generateNewAccessToken,
};
