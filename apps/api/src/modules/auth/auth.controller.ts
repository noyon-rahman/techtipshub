import httpStatus from "http-status";
import type { Context } from "hono";
import config from "../../config";
import { AppError } from "../../errors";
import type { TAppBindings } from "../../interface/bindings";
import sendResponse from "../../utils/sendResponse";
import { authService } from "./auth.service";
import {
  buildGoogleAuthorizeUrl,
  fetchGoogleProfile,
  GoogleAuthError,
  isGoogleOAuthConfigured,
} from "./google-oauth";
import { createOAuthState, verifyOAuthState } from "./oauth-state";
import {
  clearSessionCookies,
  readRefreshToken,
  setAccessTokenCookie,
  setSessionCookies,
} from "./session-cookies";
import { claimHandoff, createHandoff } from "./session-handoff";

/**
 * Spend a handoff code from a Google callback and receive the session.
 *
 * The site calls this from its server, so the cookies in the answer are read by
 * a server and written for the site's own host. Nothing here trusts the caller
 * with anything a code did not already contain: the code is single use and
 * short-lived, and this route sets the same cookies a password sign-in would.
 */
const claimSession = async (c: Context<TAppBindings>) => {
  const body = c.get("validatedBody") as { handoff?: string };
  const session = await claimHandoff(body?.handoff ?? "");

  if (!session) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "That sign-in link has expired. Start the sign-in again.",
    );
  }

  setSessionCookies(c, session);

  return sendResponse(c, httpStatus.OK, { data: { signedIn: true } });
};

const register = async (c: Context<TAppBindings>) => {
  const result = await authService.register(c.get("validatedBody"));

  return sendResponse(c, httpStatus.CREATED, { data: result });
};

const login = async (c: Context<TAppBindings>) => {
  const outcome = await authService.login(c.get("validatedBody"));

  setSessionCookies(c, outcome);

  return sendResponse(c, httpStatus.OK, { data: { user: outcome.user } });
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

/**
 * Trade a live refresh token for a new access token.
 *
 * The refresh token arrives as a cookie, because the site's server relays the
 * browser's own cookies. It is read here rather than through `validate`, so a
 * member with no session gets a plain "signed out" answer instead of a
 * validation message about a missing field.
 */
const generateNewAccessToken = async (c: Context<TAppBindings>) => {
  const refreshToken = readRefreshToken(c);

  if (!refreshToken) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Session expired. Sign in again.",
    );
  }

  const { accessToken, user } =
    await authService.generateNewAccessToken(refreshToken);

  setAccessTokenCookie(c, accessToken);

  return sendResponse(c, httpStatus.OK, { data: { user } });
};

/**
 * Who is signed in, as the API sees it.
 *
 * The site calls this before ruling on a protected page, so it never has to
 * read a token, compare an expiry or know what a role is worth. When the access
 * token has run out but the refresh token has not, a new one is issued here and
 * sent back as a cookie: the API is what renews a session, not the caller.
 */
const readSession = async (c: Context<TAppBindings>) => {
  const accessToken = c.req.header("authorization")?.split(" ")[1];
  const session = await authService.readSession(
    accessToken,
    readRefreshToken(c),
  );

  if (session.signedIn && "renewed" in session && session.renewed) {
    setSessionCookies(c, session.renewed);
  }

  return sendResponse(c, httpStatus.OK, {
    data: session.signedIn
      ? { signedIn: true, user: session.user }
      : { signedIn: false },
  });
};

/**
 * Sign out.
 *
 * Both halves matter: the cookies leave the browser, and the refresh token is
 * revoked on the server so a copy taken earlier stops working at its next
 * check. It answers OK even when there was no session, because a sign-out that
 * can fail is one someone stays signed in through.
 */
const logOut = async (c: Context<TAppBindings>) => {
  await authService.logOut(readRefreshToken(c));

  clearSessionCookies(c);

  return sendResponse(c, httpStatus.OK, { data: { signedIn: false } });
};

/**
 * Only a path on this site is accepted as the place to land after sign-in.
 * A full URL would turn the callback into an open redirect.
 */
const safeRedirect = (value: string | undefined | null) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/";

/**
 * Why a sign-in did not finish, in words the login page can show.
 *
 * A short code rather than the error's own message: the page owns its copy, and
 * a server message can carry a token, an address or an upstream status that has
 * no business in a URL, a Referer header or a log. The detail goes to the server
 * log instead, where whoever operates the API can act on it.
 */
type TGoogleFailure =
  | "cancelled"
  | "no_code"
  | "state"
  | "not_configured"
  | "unverified"
  | "exchange_failed"
  | "profile_failed"
  | "account_deleted"
  | "account_blocked"
  | "account_conflict"
  | "unavailable";

/**
 * Start Google sign-in: remember where the reader was headed, then hand the
 * browser to Google.
 */
const googleStart = (c: Context<TAppBindings>) => {
  const target = safeRedirect(c.req.query("redirect"));

  if (!isGoogleOAuthConfigured()) {
    return failedGoogleSignIn(c, "not_configured", target);
  }

  return c.redirect(
    buildGoogleAuthorizeUrl(createOAuthState(target)),
    httpStatus.FOUND,
  );
};

/**
 * Google sends the browser back here with `code` and `state`.
 *
 * Google has no way to read this API's response body, so the result is a
 * redirect either way: to the site with the session when it works, and to the
 * login page with a reason when it does not.
 */
const googleCallback = async (c: Context<TAppBindings>) => {
  // Recovered before anything can fail, so a refusal still returns the reader
  // to the page they started from, and a forged state cannot choose it.
  let redirect = "/";
  try {
    redirect = safeRedirect(
      verifyOAuthState(c.req.query("state") ?? "").redirect,
    );
  } catch {
    return failedGoogleSignIn(c, "state", redirect);
  }

  // The reader pressed Cancel on Google's consent screen. Nothing failed on
  // this side, and telling them "Google sign-in did not complete" would read
  // like a broken button.
  if (c.req.query("error")) {
    return failedGoogleSignIn(c, "cancelled", redirect);
  }

  const code = c.req.query("code");

  if (!code) {
    return failedGoogleSignIn(c, "no_code", redirect);
  }

  try {
    const outcome = await authService.googleLogin(
      await fetchGoogleProfile(code),
    );

    // The relay route lives under the site's own `/api`, not at a page path.
    const url = new URL(`${siteUrl()}/api/auth/google/callback`);
    url.searchParams.set("redirect", redirect);

    // The cookies are set on this response too, which serves an API on this
    // domain. The site is somewhere else, so it is also handed a one-time code
    // to fetch this session for itself - the URL carries a code, never a token.
    setSessionCookies(c, outcome);
    url.searchParams.set("handoff", await createHandoff(outcome));

    return c.redirect(url.toString(), httpStatus.FOUND);
  } catch (error) {
    // A reason the reader can act on, or "unavailable" for anything that is
    // this server's problem. Either way the specific failure is logged.
    const reason: TGoogleFailure =
      error instanceof GoogleAuthError &&
      (error.reason === "unverified" ||
        error.reason === "exchange_failed" ||
        error.reason === "profile_failed")
        ? error.reason
        : (error as Error)?.name === "TokenExpiredError" ||
            (error as Error)?.name === "JsonWebTokenError"
          ? "state"
          : // The account rules refuse a sign-in in words the reader can act
            // on: a deleted account, a blocked one, or two accounts claiming
            // the same Google identity.
            error instanceof AppError
            ? error.statusCode === httpStatus.FORBIDDEN
              ? /blocked/i.test(error.message)
                ? "account_blocked"
                : "account_deleted"
              : error.statusCode === httpStatus.CONFLICT
                ? "account_conflict"
                : "unavailable"
            : "unavailable";

    if (
      reason === "unavailable" ||
      reason === "exchange_failed" ||
      reason === "profile_failed"
    ) {
      // eslint-disable-next-line no-console
      console.error("[auth/google/callback]", error);
    }

    return failedGoogleSignIn(c, reason, redirect);
  }
};

/** The site's own address, without the trailing slash that would double up. */
const siteUrl = () => config.CLIENT_BASE_URL.replace(/\/$/, "");

/** Send the browser to the login page with a reason the page can explain. */
const failedGoogleSignIn = (
  c: Context<TAppBindings>,
  reason: TGoogleFailure,
  redirect: string,
) => {
  const url = new URL(`${siteUrl()}/login`);
  url.searchParams.set("google", reason);

  if (redirect !== "/") url.searchParams.set("redirect", redirect);

  return c.redirect(url.toString(), httpStatus.FOUND);
};

export const authController = {
  register,
  login,
  googleStart,
  googleCallback,
  getMe,
  changePassword,
  forgetPassword,
  resetPassword,
  generateNewAccessToken,
  claimSession,
  readSession,
  logOut,
};
