"use server";

import envConfig from "@/config/env.config";
import { legacyResponse, TLegacyBody } from "@/lib/api-contract";
import axiosInstance from "@/lib/AxiosInstance";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  getAccessToken,
} from "@/lib/fetch-with-auth";
import { getSession, ISessionUser } from "@/lib/session";
import { TLoggedInUser, TLogin } from "@/types";
import { cookies } from "next/headers";

// The API's own answer, read by status rather than by guessing at the copy.
const VALIDATION_STATUS = 400;
const RATE_LIMITED_STATUS = 429;

/** Said when a reset failed for a reason no other machine can describe. */
const RESET_FAILED_MESSAGE =
  "The password was not changed: the server did not answer. Try again in a moment.";

const RATE_LIMITED_MESSAGE =
  "Too many password resets from this connection. Wait a few minutes and try again.";

const cookieOptions = {
  secure: envConfig.NODE_ENV === "production",
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

/** The site's own host, so a cookie cannot be written for someone else's domain. */
const cookieDomain = () => ({ domain: new URL(envConfig.siteUrl).hostname });

/**
 * Copy the cookies the API set on a sign-in response into this site's jar.
 *
 * The API decides what a session is and writes it; the site only relays it.
 * Nothing here reads a token or knows how long one lasts.
 */
const relaySessionCookies = async (setCookieHeader: string[]) => {
  if (setCookieHeader.length === 0) return;

  const cookieStore = await cookies();

  for (const raw of setCookieHeader) {
    const [pair] = raw.split(";");
    const index = pair.indexOf("=");
    if (index < 0) continue;

    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();

    if (name !== ACCESS_TOKEN_COOKIE && name !== REFRESH_TOKEN_COOKIE) continue;

    cookieStore.set(name, value, cookieOptions);
  }
};

const sessionCookiesOf = (headers: unknown) => {
  // Axios exposes the raw response headers on `headers` for `set-cookie`.
  const raw = (headers as Record<string, unknown> | undefined)?.["set-cookie"];

  return Array.isArray(raw)
    ? (raw as string[])
    : typeof raw === "string"
      ? [raw]
      : [];
};

/** The signed-in reader, as the API reports them, in the shape pages already use. */
const asLoggedInUser = (user: ISessionUser): TLoggedInUser => ({
  _id: user._id,
  email: user.email,
  name: user.name,
  username: user.username,
  profilePicture: user.profilePicture,
  role: user.role,
  // The site never sees a token's claims any more, so these are left unset
  // rather than invented. Read `user.role` for an authorization decision.
  iat: 0,
  exp: 0,
});

export const registerUser = async (payload: FormData) => {
  try {
    const res = await axiosInstance.post("/auth/register", payload);

    return res.data;
  } catch (err: any) {
    return err?.response?.data;
  }
};

export const loginUser = async (payload: TLogin) => {
  try {
    const res = await axiosInstance.post("/auth/login", payload);

    if (res?.data.success) {
      await relaySessionCookies(sessionCookiesOf(res.headers));
    }

    return res?.data;
  } catch (err: any) {
    return err?.response?.data;
  }
};

/**
 * Sign out.
 *
 * The API revokes the session and clears its cookies; the site then clears its
 * own. Calling the API first matters: clearing only the browser would leave a
 * stolen refresh token usable for its full lifetime.
 */
export const logOutUser = async () => {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;

  try {
    await fetch(`${envConfig.baseApi}/auth/logout`, {
      method: "POST",
      cache: "no-store",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(refreshToken
          ? { cookie: `${REFRESH_TOKEN_COOKIE}=${refreshToken}` }
          : {}),
      },
    });
  } catch {
    // The API being unreachable must not keep someone signed in here.
  }

  cookieStore.delete({ name: ACCESS_TOKEN_COOKIE, ...cookieDomain() });
  cookieStore.delete({ name: REFRESH_TOKEN_COOKIE, ...cookieDomain() });
};

/** The signed-in reader, asked of the API rather than decoded from a token. */
export const getCurrentUser = async (): Promise<TLoggedInUser | null> => {
  const session = await getSession();

  return session.signedIn ? asLoggedInUser(session.user) : null;
};

// get user profile info
export const getProfileInfo = async () => {
  try {
    // Recovers from an expired access token so the account fields are not
    // shown empty to a member who is still signed in.
    const accessToken = await getAccessToken();

    const res = await fetch(`${envConfig.baseApi}/auth/me`, {
      cache: "no-store",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    });

    return legacyResponse<unknown>(res);
  } catch (err: any) {
    return err;
  }
};

export const forgetPassword = async (payload: { email: string }) => {
  try {
    const res = await axiosInstance.post("/auth/forget-password", payload);

    return res.data;
  } catch (err: any) {
    return err?.response?.data;
  }
};

/**
 * What a failed reset says.
 *
 * The API knows why it refused: a spent or expired link, a password that
 * breaks its rule, a blocked account, too many tries. That answer is shown in
 * the API's own words, because a user can act on it. Only the case with no
 * answer at all is worded here, and it says the one true thing about that case:
 * the request never landed, so nothing changed.
 *
 * A password that breaks the rule is kept as a sentence about the field, not
 * as the API's general "did not pass validation" line: the form shows one line.
 */
const asResetFailure = (
  status: number | undefined,
  data: unknown,
): TLegacyBody => {
  const response = (
    data && typeof data === "object" ? data : { success: false }
  ) as TLegacyBody;
  const message = typeof response.message === "string" ? response.message : "";

  const fieldMessage = Array.isArray(response.errorSources)
    ? response.errorSources.find((source) => typeof source?.message === "string")
        ?.message
    : undefined;

  if (status === VALIDATION_STATUS && fieldMessage) {
    return { ...response, success: false, message: fieldMessage };
  }

  if (status === RATE_LIMITED_STATUS) {
    return { ...response, success: false, message: RATE_LIMITED_MESSAGE };
  }

  return {
    ...response,
    success: false,
    message: message || RESET_FAILED_MESSAGE,
  };
};

export const resetPassword = async (payload: {
  newPassword: string;
  token: string;
}) => {
  const { token, ...body } = payload;

  try {
    const signedIn = (await getSession()).signedIn;

    // The token identifies the account; it is never written into the URL.
    //
    // Signed out, the call goes to the API itself. The app's proxy
    // (`/api/v1/[...path]`) refuses anything without a session, and the reset
    // is exactly the call someone with no session needs to make.
    //
    // Signed in, someone may hold an admin session in another tab of this
    // browser, and a client-side call would leave that session token in the
    // header no matter what it asked for. That path answers with the reset
    // token itself, which the interceptor leaves untouched.
    const res = await axiosInstance.post(
      "/auth/reset-password",
      body,
      signedIn
        ? {
            baseURL: envConfig.baseApi,
            headers: { "X-Reset-Token": token },
          }
        : {
            baseURL: envConfig.baseApi,
            headers: { Authorization: `Bearer ${token}` },
          },
    );

    return res.data;
  } catch (err: any) {
    return asResetFailure(err?.response?.status, err?.response?.data);
  }
};

export const getNewAccessToken = async () => {
  // Same renewal rules as every other server-side call: the refresh token is
  // only used while it is still valid, and the result is written to the cookie.
  const accessToken = await getAccessToken();

  return accessToken
    ? { success: true, data: { accessToken } }
    : { success: false, message: "Session expired" };
};
