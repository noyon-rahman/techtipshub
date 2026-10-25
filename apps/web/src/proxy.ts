import { getSession } from "@/lib/session";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/fetch-with-auth";
import { requiresSession } from "@/lib/blog-routes";
import { NextRequest, NextResponse } from "next/server";

/**
 * User agents that never run the browser (see `ArticleAccess`).
 *
 * They are sent to the article's preview variant, which is the server-rendered
 * copy with real article text and the canonical URL. Handing them the plain
 * address would show a page whose body waits on a reader check they cannot
 * run.
 */
const ARTICLE_PATH = /^\/blogs\/[^/]+$/;
const PREVIEW_PARAM = "view";
const PREVIEW_VALUE = "preview";
const CRAWLER_PATTERN =
  /bot\b|bot\/|crawl|spider|slurp|\bba[iy]du\b|yandex|duckduck|facebookexternalhit|facebot|twitterbot|linkedinbot|embedly|pinterest|telegrambot|applebot|ia_archiver|google-?other|chrome-lighthouse|headlesschrome|phantomjs/i;

/**
 * The admin shell is only rendered for a session the API says holds the Admin
 * role.
 */
const isAdminPath = (pathname: string) =>
  pathname === "/admin" || pathname.startsWith("/admin/");

/**
 * The browser-side admin API (`src/app/api/admin/[...path]/route.ts`) spends
 * the session cookie, so it is held to the same Admin-role rule as the pages.
 */
const isAdminApiPath = (pathname: string) => pathname.startsWith("/api/admin/");

/**
 * Old addresses for the article editor.
 *
 * The composer and the editor have both moved over time:
 * `/settings/update/<slug>` → `/settings/edit/<slug>` → `/me/blogs/<slug>/edit`,
 * and `/write-blog` → `/me/blogs/new`. Every one of them still redirects, so
 * bookmarks, shared links and search results keep working.
 *
 * The two renamed public pages (`/about-us`, `/contact-us`) redirect from
 * `src/app/…/route.ts` instead, which sees the request before the router
 * normalises a trailing slash.
 */
const LEGACY_REDIRECTS: { prefix: string; to: (rest: string) => string }[] = [
  {
    prefix: "/settings/update/",
    to: (slug) => `/me/blogs/${slug}/edit`,
  },
  {
    prefix: "/settings/edit/",
    to: (slug) => `/me/blogs/${slug}/edit`,
  },
  // Admin screens used to live under /settings. Each old address lands on the
  // screen that replaced it, so existing bookmarks and links keep working.
  {
    prefix: "/settings/admin/manage-blogs",
    to: () => "/admin/manage-blogs",
  },
  {
    prefix: "/settings/admin/manage-users",
    to: () => "/admin/manage-users",
  },
  {
    prefix: "/settings/admin/dashboard",
    to: () => "/admin/dashboard",
  },
];

const LEGACY_EXACT: Record<string, string> = {
  "/write-blog": "/me/blogs/new",
  "/settings/admin": "/admin/dashboard",
  "/admin": "/admin/dashboard",
};

/**
 * Hand back a session cookie the API renewed while `getSession` was asking.
 *
 * A page render in Next may not write cookies; a proxy may. Writing the renewed
 * pair here is what lets an expired access token come back to life on the very
 * request that noticed it, instead of the member being signed out by it.
 */
const relayRenewedCookies = (request: NextRequest, response: NextResponse) => {
  const site = new URL(request.url);

  for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]) {
    const value = request.cookies.get(name)?.value;
    if (!value) continue;

    response.cookies.set(name, value, {
      domain: site.hostname,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
};

/**
 * Session handling for the whole app.
 *
 * The site does not decide what a session is. It asks the API once — "who is
 * this?" — and follows the answer, so an expired access token, a revoked
 * session, a changed password and a role change all take effect here the
 * moment the API says so, with no second implementation to keep in step.
 *
 * This is a *filter*, not the gate. Pages and server actions check the session
 * again before acting (Next's own advice: a proxy check is optimistic and runs
 * on prefetches too). It exists so a signed-out visitor gets the login page
 * instead of an editor that cannot save.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Old addresses, before anything else touches the request.
  const legacy = LEGACY_REDIRECTS.find((entry) =>
    pathname.startsWith(entry.prefix),
  );
  if (legacy) {
    const url = request.nextUrl.clone();
    url.pathname = legacy.to(pathname.slice(legacy.prefix.length));
    return NextResponse.redirect(url, 308);
  }

  const legacyExact = LEGACY_EXACT[pathname.replace(/\/$/, "")];
  if (legacyExact) {
    const url = request.nextUrl.clone();
    url.pathname = legacyExact;
    return NextResponse.redirect(url, 308);
  }

  // 1b. An article, to a crawler or link unfurl: point it at the preview
  // variant, which carries the article text server-side and is the canonical
  // address in the page metadata. Action requests are left alone: they are not
  // page reads, and rewriting them would put the preview variant in the answer.
  const isArticle = ARTICLE_PATH.test(pathname.replace(/\/$/, ""));
  const userAgent = request.headers.get("user-agent") ?? "";
  const isAction = request.headers.has("next-action");
  if (
    isArticle &&
    !isAction &&
    request.method === "GET" &&
    CRAWLER_PATTERN.test(userAgent) &&
    request.nextUrl.searchParams.get(PREVIEW_PARAM) !== PREVIEW_VALUE
  ) {
    const url = request.nextUrl.clone();
    url.searchParams.set(PREVIEW_PARAM, PREVIEW_VALUE);
    return NextResponse.rewrite(url);
  }

  // 2. Pages open to everyone, and action requests, need no ruling: an action
  // re-checks the session in the server function that runs it.
  const isRuled = isAdminPath(pathname) || isAdminApiPath(pathname);
  if (!isRuled && (isAction || !requiresSession(pathname))) {
    return NextResponse.next();
  }

  // 3. The API's answer, with any renewed cookies already written to this
  // request and its response.
  const session = await getSession();
  const response = NextResponse.next({ request });
  relayRenewedCookies(request, response);

  if (session.signedIn) {
    if (isAdminApiPath(pathname) && session.user.role !== "Admin") {
      return NextResponse.json(
        { error: { message: "Admin access required" } },
        { status: 403 },
      );
    }

    if (isAdminPath(pathname) && session.user.role !== "Admin") {
      return NextResponse.redirect(new URL("/", request.nextUrl));
    }

    return response;
  }

  if (isAdminApiPath(pathname)) {
    return NextResponse.json(
      { error: { message: "Not signed in" } },
      { status: 401 },
    );
  }

  // Still signed out: the account area and the article editor send the visitor
  // to log in and come back to exactly where they were.
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  url.searchParams.set("redirect", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  // Pages and API routes only; static assets and image optimisation carry
  // no session and should never wait on a token call.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)",
  ],
};
