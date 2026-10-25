import httpStatus from "http-status";
import type { Context } from "hono";
import { setCookie } from "hono/cookie";
import config from "../../config";
import { AppError } from "../../errors";
import type { TAppBindings } from "../../interface/bindings";
import sendResponse from "../../utils/sendResponse";
import { authService } from "./auth.service";
import {
  buildGoogleAuthorizeUrl,
  fetchGoogleProfile,
  isGoogleOAuthConfigured,
} from "./google-oauth";
import { createOAuthState, verifyOAuthState } from "./oauth-state";

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
    // Seconds, not milliseconds: 365 days is the longest the spec allows.
    maxAge: 60 * 60 * 24 * 365,
  });
};

/**
 * The session as cookies rather than a JSON body.
 *
 * A Google callback is followed by the browser, not read by script, so the
 * tokens have to arrive as headers. The names and lifetime match the ones the
 * web app sets from `/auth/login`, which keeps one session shape for both.
 */
const setSessionCookies = (
  c: Context<TAppBindings>,
  outcome: { accessToken: string; refreshToken: string },
  response: Response,
) => {
  const options = {
    secure: config.NODE_ENV === "production",
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  } as const;

  setCookie(c, "tth_access_token", outcome.accessToken, {
    ...options,
    httpOnly: true,
  });
  setCookie(c, "tth_refresh_token", outcome.refreshToken, {
    ...options,
    httpOnly: true,
  });

  return response;
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

const getMe = async (c: Context<TAppBindings>) => {
  const user = await authService.getMe(c.get("user"));

  return sendResponse(c, httpStatus.OK, { data: user });
};

const changePassword = async (c: Context<TAppBindings>) => {
  const result = await authService.changePassword(
    c.get("user"),
    c.get("validatedBody"),
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const forgetPassword = async (c: Context<TAppBindings>) => {
  const { email } = c.get("validatedBody") as { email: string };
  const result = await authService.forgetPassword(email);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const resetPassword = async (c: Context<TAppBindings>) => {
  const token = c.req.header("authorization")?.split(" ")[1];

  if (!token) {
    throw new AppError(httpStatus.FORBIDDEN, "Access Forbidden");
  }

  const result = await authService.resetPassword(c.get("validatedBody"), token);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const generateNewAccessToken = async (c: Context<TAppBindings>) => {
  const { refreshToken } = c.get("validatedCookies") as {
    refreshToken: string;
  };

  const newAccessToken = await authService.generateNewAccessToken(refreshToken);

  return sendResponse(c, httpStatus.OK, { data: { accessToken: newAccessToken } });
};

/**
 * Only a path on this site is accepted as the place to land after sign-in.
 * A full URL would turn the callback into an open redirect.
 */
const safeRedirect = (value: string | undefined) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/";

/**
 * Start Google sign-in: remember where the reader was headed, then hand the
 * browser to Google.
 */
const googleStart = (c: Context<TAppBindings>) => {
  if (!isGoogleOAuthConfigured()) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Google sign-in is not configured on this server.",
    );
  }

  const state = createOAuthState(safeRedirect(c.req.query("redirect")));

  return c.redirect(buildGoogleAuthorizeUrl(state), httpStatus.FOUND);
};

/**
 * Google sends the browser back here with `code` and `state`.
 *
 * Google has no way to read this API's response body, so the result is a
 * redirect either way: to the site with the session when it works, and to the
 * login page with a reason when it does not.
 */
const googleCallback = async (c: Context<TAppBindings>) => {
  const site = config.CLIENT_BASE_URL.replace(/\/$/, "");

  let redirect = "/";

  try {
    const { redirect: target } = verifyOAuthState(c.req.query("state") ?? "");
    redirect = target;

    const code = c.req.query("code");

    if (!code) {
      throw new AppError(
        httpStatus.UNAUTHORIZED,
        "Google sign-in was cancelled.",
      );
    }

    const outcome = await authService.googleLogin(
      await fetchGoogleProfile(code),
    );

    const url = new URL(`${site}/auth/google/callback`);
    url.searchParams.set("redirect", redirect);

    return setSessionCookies(c, outcome, c.redirect(url.toString(), httpStatus.FOUND));
  } catch (error) {
    const message =
      error instanceof AppError
        ? error.message
        : "Google sign-in did not complete. Try again.";

    const url = new URL(`${site}/login`);
    url.searchParams.set("error", message);
    if (redirect !== "/") url.searchParams.set("redirect", redirect);

    return c.redirect(url.toString(), httpStatus.FOUND);
  }
};

export const authController = {
  register,
  login,
  socialLogin,
  googleStart,
  googleCallback,
  getMe,
  changePassword,
  forgetPassword,
  resetPassword,
  generateNewAccessToken,
};
