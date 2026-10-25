import { NextRequest, NextResponse } from "next/server";
import { hasSession, safeRedirect } from "../route";

/**
 * The API's redirect URI points here once Google has answered.
 *
 * The API has already set the session cookies on this domain, so the only job
 * left is to send the reader on to the page they started from. A hop through a
 * page rather than straight from the API keeps the login error message on the
 * site's own address instead of an API URL carrying query strings.
 */
export const GET = (request: NextRequest) => {
  const redirect = safeRedirect(request.nextUrl.searchParams.get("redirect"));

  if (!hasSession(request)) {
    const login = new URL("/login", request.nextUrl);
    login.searchParams.set("error", "Google sign-in did not complete.");
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(new URL(redirect, request.nextUrl));
};
