import envConfig from "@/config/env.config";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/fetch-with-auth";

/**
 * Server-to-server exchange of cookies the API set.
 *
 * A browser only keeps a `Set-Cookie` from a site it is talking to, and the API
 * lives on its own domain. So whenever the API issues a session, this app makes
 * the request itself, reads the cookies out of the answer, and writes them for
 * its own host. Nothing here interprets a token: the names, values and
 * lifetimes are the API's.
 */
export interface ISessionCookie {
  name: string;
  value: string;
  maxAge: number;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/** The session cookies in a response, as something `cookies().set` can write. */
export const sessionCookiesFrom = (
  setCookieHeaders: string[],
): ISessionCookie[] => {
  const cookies: ISessionCookie[] = [];

  for (const raw of setCookieHeaders) {
    const [pair] = raw.split(";");
    const index = pair.indexOf("=");
    if (index < 0) continue;

    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();

    if (name !== ACCESS_TOKEN_COOKIE && name !== REFRESH_TOKEN_COOKIE) continue;
    if (!value) continue;

    cookies.push({ name, value, maxAge: COOKIE_MAX_AGE });
  }

  return cookies;
};

/**
 * Turn the single-use handoff code from a Google callback into a session.
 *
 * The code is the API's answer to "the browser could not carry your cookies, so
 * here is how to fetch them": short-lived, single-use, and bound to the session
 * that response created. It is spent the first time it is claimed, so a URL
 * copied from a history entry or shared by mistake yields nothing.
 */
export const claimGoogleSession = async (
  handoff: string,
): Promise<ISessionCookie[] | null> => {
  try {
    const response = await fetch(`${envConfig.baseApi}/auth/session/claim`, {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ handoff }),
    });

    if (!response.ok) return null;

    const cookies = sessionCookiesFrom(response.headers.getSetCookie?.() ?? []);

    return cookies.length > 0 ? cookies : null;
  } catch {
    return null;
  }
};
