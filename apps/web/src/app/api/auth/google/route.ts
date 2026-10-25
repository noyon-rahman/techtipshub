import { NextRequest, NextResponse } from "next/server";
import { baseApi } from "@/config/api";

const ACCESS_TOKEN_COOKIE = "tth_access_token";

/** A path on this site, so `?redirect=` can never send a reader off-site. */
export const safeRedirect = (value: string | null) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/";

/**
 * Hands the browser to the API, which owns the Google client secret.
 *
 * A redirect rather than a fetch: the reader has to see Google's own consent
 * screen, and only the browser can be sent there.
 */
export async function GET(request: NextRequest) {
  const redirect = safeRedirect(request.nextUrl.searchParams.get("redirect"));

  const url = new URL(`${baseApi}/auth/google`);
  url.searchParams.set("redirect", redirect);

  return NextResponse.redirect(url, 307);
}

/** Whether this browser came back from a Google sign-in. */
export const hasSession = (request: NextRequest) =>
  Boolean(request.cookies.get(ACCESS_TOKEN_COOKIE)?.value);
