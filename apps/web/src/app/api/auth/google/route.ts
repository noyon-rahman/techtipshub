import { NextResponse } from "next/server";
import { baseApi } from "@/config/api";
import { googleRedirectPath } from "@/lib/google-auth";

/**
 * Hands the browser to the API, which owns the Google client secret.
 *
 * A redirect rather than a fetch: the reader has to see Google's own consent
 * screen, and only the browser can be sent there. The API signs the `redirect`
 * into the state it returns, so where the reader lands after sign-in is decided
 * on the server, not by whoever edits this URL.
 */
export async function GET(request: Request) {
  const redirect = googleRedirectPath(
    new URL(request.url).searchParams.get("redirect"),
  );

  const url = new URL(`${baseApi}/auth/google`);
  if (redirect !== "/") url.searchParams.set("redirect", redirect);

  return NextResponse.redirect(url, 307);
}
