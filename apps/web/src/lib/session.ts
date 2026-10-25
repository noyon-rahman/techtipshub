import envConfig from "@/config/env.config";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/fetch-with-auth";
import { cookies } from "next/headers";

/** What the API says about the request's session. */
export interface ISessionUser {
  _id: string;
  email: string;
  name: string;
  username: string;
  profilePicture: string;
  role: "User" | "Admin";
}

export type TSession =
  | { signedIn: true; user: ISessionUser }
  | { signedIn: false };

const SIGNED_OUT: TSession = { signedIn: false };

/** Only this site's own domain is written to, so a stray cookie cannot redirect elsewhere. */
const cookieDomain = () => {
  const site = new URL(envConfig.siteUrl);

  return { domain: site.hostname };
};

const isPageRender = () =>
  Boolean(process.env.NEXT_RUNTIME) && process.env.NEXT_PHASE !== "phase-production-build";

/**
 * Who is signed in, according to the API.
 *
 * This is the only place the site learns about a session. It does not read a
 * token, compare an expiry or interpret a role: it passes the browser's
 * cookies to the API and gets back the answer. Everything that makes a session
 * valid — signature, revocation, a password change, a blocked account — is
 * decided in one place on the server, so the site cannot drift out of step with
 * it.
 *
 * When the API renews a session it returns new cookies, and they are written
 * here. A page render is not allowed to write cookies in Next, so `proxy.ts`
 * calls this as well: by the time a page reads the session the cookies are
 * already current.
 */
export const getSession = async (): Promise<TSession> => {
  if (typeof window !== "undefined") return SIGNED_OUT;

  let requestCookies: string;
  let cookieStore: Awaited<ReturnType<typeof cookies>> | undefined;

  try {
    cookieStore = await cookies();
    requestCookies = cookieStore
      .getAll()
      .filter(
        (cookie) =>
          cookie.name === ACCESS_TOKEN_COOKIE ||
          cookie.name === REFRESH_TOKEN_COOKIE,
      )
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
  } catch {
    // Outside a request (a build-time render), there is no session to read.
    return SIGNED_OUT;
  }

  if (!requestCookies) return SIGNED_OUT;

  let response: Response;

  try {
    response = await fetch(`${envConfig.baseApi}/auth/session`, {
      cache: "no-store",
      headers: { cookie: requestCookies },
    });
  } catch {
    // The API being unreachable is not the same as being signed out, but a
    // page cannot wait on it, and treating it as signed out is what the login
    // redirect already handles.
    return SIGNED_OUT;
  }

  if (!response.ok) return SIGNED_OUT;

  const body = (await response.json()) as {
    data?: { signedIn?: boolean; user?: ISessionUser };
  };

  if (!body.data?.signedIn || !body.data.user) return SIGNED_OUT;

  // A renewed session arrives as cookies. Only a proxy or a route handler may
  // write them; anywhere else they are picked up on the next request.
  const setCookies = response.headers.getSetCookie?.() ?? [];
  if (cookieStore && setCookies.length > 0 && isPageRender()) {
    for (const raw of setCookies) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      if (index < 0) continue;

      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      const isRemoval = /max-age=0/i.test(raw);

      if (name !== ACCESS_TOKEN_COOKIE && name !== REFRESH_TOKEN_COOKIE) continue;

      cookieStore.set(name, value, {
        ...cookieDomain(),
        httpOnly: true,
        secure: envConfig.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        ...(isRemoval ? { maxAge: 0 } : {}),
      });
    }
  }

  return { signedIn: true, user: body.data.user };
};
