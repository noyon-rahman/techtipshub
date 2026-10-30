import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { baseApi } from "@/config/api";
import {
  ARTICLE_TOO_LARGE,
  COVER_MAX_BYTES,
  COVER_TOO_LARGE,
} from "@/lib/upload-limits";

/**
 * The browser's way to the API for a signed-in reader.
 *
 * Voting and following happen after the page has loaded, in the browser, and
 * the session cookies are httpOnly, so the browser has no token to send. These
 * calls come here instead, and this handler forwards `/api/v1/<rest>` to the
 * API's own `<rest>` with the session attached. The answer is passed back
 * unchanged, in the API's own `{ data | error }` shape; the axios instance
 * translates it the same way it translates a server-side call.
 *
 * Which operations may pass is a list, not the whole API: a public site has no
 * reason to let a page reach every route the API publishes, and a route added
 * to the API later should not become reachable here by accident.
 *
 * Nothing in this answer is shared: it is per reader and never cached.
 */
const ALLOWED: { method: string; pattern: RegExp }[] = [
  // One article by slug, for the reader's own vote state.
  { method: "GET", pattern: /^blogs\/[^/]+$/ },
  { method: "GET", pattern: /^blogs\/[^/]+\/vote-status$/ },
  // A cover goes up the moment it is picked, and comes back down when the
  // writer replaces, removes or abandons it. The file passes through this
  // handler only as bytes; the API stores it in Cloudinary and answers with
  // the URL the article will carry. Publishing itself is a server action, so
  // it is not listed here (it never was).
  { method: "POST", pattern: /^uploads\/cover$/ },
  { method: "DELETE", pattern: /^uploads\/asset$/ },
  // The vote itself.
  { method: "PUT", pattern: /^blogs\/[^/]+\/vote$/ },
  // Whether the reader follows the member whose page they are on.
  { method: "GET", pattern: /^users\/[^/]+\/follow-status$/ },
  // Follow and unfollow.
  { method: "PUT", pattern: /^users\/[^/]+\/follow$/ },
  { method: "DELETE", pattern: /^users\/[^/]+\/unfollow$/ },
  // The composer's category step: a member who needs a topic the list does not
  // have makes it on the spot, from an editor that is already open in the
  // browser, so the call needs the session and cannot be signed server-side.
  // "Create" here is a live category for the whole site, not a request.
  { method: "POST", pattern: /^categories$/ },
  // The public category list, for the composer's picker: the writer has to be
  // able to retry a list that failed to load without losing the draft. It is
  // the same list the pages already render, and this answer is never cached.
  { method: "GET", pattern: /^categories$/ },
];

const UNSAFE = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * The cover upload is the one multipart body here, so it is held to the cover
 * limit plus room for the envelope; everything else is the article JSON, which
 * `validateUploadSize` already keeps under that same number. Past the limit the
 * request is answered here, so the writer gets a sentence they can act on
 * instead of the platform's bare 413.
 */
const MULTIPART_HEADROOM_BYTES = 256 * 1024;

const isCoverUpload = (method: string, rest: string) =>
  method === "POST" && rest === "uploads/cover";

const isAllowed = (method: string, rest: string) =>
  ALLOWED.some((rule) => rule.method === method && rule.pattern.test(rest));

const refuse = (message: string, status: number) =>
  NextResponse.json({ error: { message } }, { status });

const handler = async (
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) => {
  const { path } = await context.params;
  const rest = (path ?? []).join("/");

  if (!isAllowed(request.method, rest)) {
    return refuse("Not available here", 404);
  }

  // Same-origin guard for state changes: the browser sends the cookie on a
  // same-site request, and a forged form post from another site must not
  // borrow the session.
  const origin = request.headers.get("origin");
  if (origin && UNSAFE.has(request.method)) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      originHost = null;
    }

    if (!originHost || originHost !== request.headers.get("host")) {
      return refuse("Cross-origin request refused", 403);
    }
  }

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  headers.set("accept", "application/json");

  const accessToken = (await cookies()).get("tth_access_token")?.value;
  if (!accessToken) return refuse("Not signed in", 401);
  headers.set("authorization", `Bearer ${accessToken}`);

  const target = new URL(`${baseApi}/${rest}`);
  target.search = new URL(request.url).search;

  // Read once: a Request body cannot be read twice, so the same bytes are both
  // measured here and forwarded below.
  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;
  // A cover arrives as multipart with the envelope on top; every other body is
  // a JSON call that `validateUploadSize` already keeps under the same number.
  const coverUpload = isCoverUpload(request.method, rest);
  const limit = coverUpload
    ? COVER_MAX_BYTES + MULTIPART_HEADROOM_BYTES
    : COVER_MAX_BYTES;
  if (body && body.byteLength > limit) {
    return refuse(coverUpload ? COVER_TOO_LARGE : ARTICLE_TOO_LARGE, 413);
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return refuse("The API did not answer", 502);
  }

  const response = new NextResponse(await upstream.arrayBuffer(), {
    status: upstream.status,
  });
  const upstreamType = upstream.headers.get("content-type");
  if (upstreamType) response.headers.set("content-type", upstreamType);
  response.headers.set("cache-control", "no-store");

  return response;
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
