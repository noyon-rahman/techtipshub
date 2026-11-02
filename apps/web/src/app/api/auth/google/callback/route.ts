import { NextResponse } from "next/server";
import { afterSignInPath } from "@/lib/blog-routes";
import { ACCESS_TOKEN_COOKIE } from "@/lib/fetch-with-auth";
import { googleRedirectPath } from "@/lib/google-auth";
import { readInterests } from "@/services/reader/interests";
import { readUsernameOnboarding } from "@/services/reader/username";
import { claimGoogleSession } from "@/lib/session-relay";

/**
 * Where the API sends the browser once Google has answered, to finish the
 * sign-in.
 *
 * The API has already set the session cookies, but on *its* domain: a browser
 * only accepts a cookie for the site that sent it, so they do nothing here.
 * This route is therefore the one place the site receives a session - it takes
 * the signed handoff code the API put in the URL and trades it for the
 * cookies, server to server, exactly as it does after a password sign-in.
 *
 * The code is signed by the API with `GOOGLE_STATE_SECRET` (the access-token
 * secret where that is unset), so a build whose environment holds a different
 * value answers `unavailable` for every sign-in. When Google sign-in stops
 * working after a deploy, compare that variable on both apps first.
 *
 * A failed sign-in never reaches this route: the API sends those straight to
 * `/login` with a reason the page explains.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const handoff = searchParams.get("handoff");
  const redirect = googleRedirectPath(searchParams.get("redirect"));

  const session = handoff ? await claimGoogleSession(handoff) : null;

  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("google", "unavailable");
    url.searchParams.set("redirect", redirect);
    return NextResponse.redirect(url);
  }

  // The cookies are not on the browser yet, so both answers are read with the
  // token this handoff just produced. A member who has not confirmed their
  // handle meets the username step first, then the interests step, then
  // `redirect`; when an answer cannot be read, that step is skipped rather than
  // blocking a sign-in.
  const accessToken = session.find(
    (cookie) => cookie.name === ACCESS_TOKEN_COOKIE,
  )?.value;

  const [username, interests] = accessToken
    ? await Promise.all([
        readUsernameOnboarding(accessToken),
        readInterests(accessToken),
      ])
    : [undefined, undefined];

  const response = NextResponse.redirect(
    new URL(
      afterSignInPath(redirect, {
        onboarded: username?.success
          ? username.data?.onboarded === true
          : true,
        interestsAnswered: interests?.success
          ? interests.data?.answered === true
          : true,
      }),
      request.url,
    ),
  );
  const secure = process.env.NODE_ENV === "production";

  for (const cookie of session) {
    response.cookies.set(cookie.name, cookie.value, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      maxAge: cookie.maxAge,
    });
  }

  return response;
}
