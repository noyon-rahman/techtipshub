import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import config from "../../config";
import type { TAppBindings } from "../../interface/bindings";

/**
 * How this API stores a session: two httpOnly cookies.
 *
 * The browser never reads them. The access token is sent to the API as a
 * bearer token by this site's server, and the refresh token is only ever
 * exchanged at `/auth/refresh-token` and `/auth/logout`.
 *
 * The attribute rules live here and nowhere else, so a sign-in, a refresh and a
 * sign-out cannot disagree about what they are writing. `sameSite: Lax` is set
 * explicitly because Hono, unlike Express, adds no default: it is what stops
 * another site from driving a signed-in request.
 */
export const ACCESS_TOKEN_COOKIE = "tth_access_token";
export const REFRESH_TOKEN_COOKIE = "tth_refresh_token";

/**
 * Seconds, the longest a cookie may live. The tokens inside expire sooner;
 * the cookie outlives them so the API is the one deciding whether a session is
 * still good, not the browser dropping it.
 */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const cookieOptions = () => ({
  secure: config.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "Lax",
  path: "/",
  maxAge: COOKIE_MAX_AGE,
}) as const;

export const setSessionCookies = (
  c: Context<TAppBindings>,
  outcome: { accessToken: string; refreshToken: string },
) => {
  setCookie(c, ACCESS_TOKEN_COOKIE, outcome.accessToken, cookieOptions());
  setCookie(c, REFRESH_TOKEN_COOKIE, outcome.refreshToken, cookieOptions());
};

/** Write only a renewed access token, leaving the refresh token as it is. */
export const setAccessTokenCookie = (
  c: Context<TAppBindings>,
  accessToken: string,
) => setCookie(c, ACCESS_TOKEN_COOKIE, accessToken, cookieOptions());

/**
 * Remove both cookies. A sign-out that only cleared the browser would leave a
 * copied refresh token usable, which is why the route also revokes.
 */
export const clearSessionCookies = (c: Context<TAppBindings>) => {
  deleteCookie(c, ACCESS_TOKEN_COOKIE, { path: "/" });
  deleteCookie(c, REFRESH_TOKEN_COOKIE, { path: "/" });
};

export const readRefreshToken = (c: Context<TAppBindings>) =>
  getCookie(c, REFRESH_TOKEN_COOKIE);
