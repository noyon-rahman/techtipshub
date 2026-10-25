import { NextResponse } from "next/server";
import { googleRedirectPath } from "@/lib/google-auth";
import { claimGoogleSession } from "@/lib/session-relay";

/**
 * Where the API sends the browser once Google has answered, to finish the
 * sign-in.
 *
 * The API has already set the session cookies, but on *its* domain: a browser
 * only accepts a cookie for the site that sent it, so they do nothing here.
 * This route is therefore the one place the site receives a session — it takes
 * the single-use handoff code the API put in the URL and trades it for the
 * cookies, server to server, exactly as it does after a password sign-in.
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

  const response = NextResponse.redirect(new URL(redirect, request.url));
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
