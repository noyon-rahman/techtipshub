import { getSession } from "@/lib/session";
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
} from "@/lib/fetch-with-auth";
import { publicProfilePath, requiresSession } from "@/lib/blog-routes";
import { categoryPath, personalFeedPath, searchPath } from "@/lib/feed-routes";
import { normaliseRouteUsername } from "@/utils/username";
import { NextRequest, NextResponse } from "next/server";

const ARTICLE_PATH = /^\/blogs\/[^/]+$/;
const PREVIEW_PARAM = "view";
const PREVIEW_VALUE = "preview";

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
 * Old addresses for the article editor and the account area.
 *
 * The composer, the editor and the profile screens have all moved over time:
 * `/settings/update/<slug>` → `/settings/edit/<slug>` → `/me/blogs/<slug>/edit`
 * → `/profile/blogs/<slug>/edit` → `/blogs/<slug>/edit`, and `/write-blog`,
 * `/me/blogs/new`, `/profile/blogs/new` → `/blogs/new`. Settings itself went
 * away: the profile page is the place its fields are edited now, so `/me/blogs`,
 * `/me` and every `/settings` address land on the member's own profile at
 * `/profile`. Every one of them still redirects, so bookmarks, shared links and
 * search results keep working.
 *
 * The two renamed public pages (`/about-us`, `/contact-us`) redirect from
 * `src/app/…/route.ts` instead, which sees the request before the router
 * normalises a trailing slash.
 *
 * `/you` is a synonym retired early: the reader's own list is `/personalized`,
 * named for what it shows, and the old address is kept alive in `LEGACY_EXACT`.
 */
const LEGACY_REDIRECTS: { prefix: string; to: (rest: string) => string }[] = [
  {
    prefix: "/settings/update/",
    to: (slug) => `/blogs/${slug}/edit`,
  },
  {
    prefix: "/settings/edit/",
    to: (slug) => `/blogs/${slug}/edit`,
  },
  {
    prefix: "/profile/blogs/",
    to: (rest) => `/blogs/${rest}`,
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
  "/write-blog": "/blogs/new",
  "/me/blogs/new": "/blogs/new",
  // The reader's own list was `/you` before it was named for what it shows.
  // A query string survives: the exact-match redirect only replaces the path.
  "/you": personalFeedPath,
};

/** Settings addresses from every past shape; they resolve to the profile. */
const LEGACY_SETTINGS = new Set([
  "/me",
  "/me/blogs",
  "/settings",
  "/settings/manage-blogs",
]);

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
 * The site does not decide what a session is. It asks the API once - "who is
 * this?" - and follows the answer, so an expired access token, a revoked
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
    // The query string rides along, so an old editor link keeps its context.
    // The exact-match redirects below start clean.
    url.pathname = legacy.to(pathname.slice(legacy.prefix.length));
    return NextResponse.redirect(url, 308);
  }

  const legacyExact = LEGACY_EXACT[pathname.replace(/\/$/, "")];
  if (legacyExact) {
    const url = request.nextUrl.clone();
    url.pathname = legacyExact;
    return NextResponse.redirect(url, 308);
  }

  const bare = pathname.replace(/\/$/, "");

  // 1a. The member's own profile used to carry their handle (`/profile/@name`)
  // and sat at `/profile/<username>`. It is `/profile` now, because the page
  // describes whoever holds the session; the public address a reader sees is
  // `/users/<handle>`. Old links, and anything shared while the handle was in
  // the path, land on the one address. A permanent redirect, unlike the
  // settings aliases below, which depend on who is asking.
  if (
    bare.startsWith("/profile/@") ||
    (bare.startsWith("/profile/") && !bare.startsWith("/profile/blogs"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/profile";
    return NextResponse.redirect(url, 308);
  }

  // 1b. Settings became part of the member's own profile page. The address
  // depends on the session, and a signed-in member gets a 308 so the profile
  // is what their address bar keeps. A signed-out visitor skips this dict and
  // falls through to the login redirect at the bottom, coming back to the
  // profile afterwards.
  if (LEGACY_SETTINGS.has(bare)) {
    const session = await getSession();
    if (session.signedIn) {
      const url = request.nextUrl.clone();
      // Without a handle there is no profile page to land on yet: that member
      // still has the handle step ahead of them, so they get the article list.
      url.pathname = session.user.username ? "/profile" : "/profile/blogs";
      const response = NextResponse.redirect(url, 308);
      relayRenewedCookies(request, response);
      return response;
    }
  }

  // 1c. Legacy query-filtered home URLs (`/?category=...`, `/?search=...`)
  // moved to `/categories/<slug>` and `/search?q=...`. Redirect them
  // permanently so crawlers and old links land on the canonical route.
  if (pathname === "/") {
    const category = request.nextUrl.searchParams.get("category");
    if (category !== null) {
      const target = new URL(categoryPath(category), request.url);
      return NextResponse.redirect(target, 308);
    }

    const search = request.nextUrl.searchParams.get("search");
    if (search !== null) {
      const target = new URL(searchPath(search), request.url);
      return NextResponse.redirect(target, 308);
    }
  }

  // 1d. Public profiles are canonical at `/users/<handle>` without `@`.
  // Redirect `/users/@<handle>` (or `%40<handle>`) permanently to the
  // canonical path so crawlers do not treat it as a duplicate page.
  if (bare.startsWith("/users/")) {
    const rawSegment = bare.slice("/users/".length);
    if (!rawSegment.includes("/")) {
      let decoded = rawSegment;
      try {
        decoded = decodeURIComponent(rawSegment);
      } catch {
        // Keep raw segment if percent-encoding is malformed.
      }
      if (decoded.startsWith("@")) {
        const handle = normaliseRouteUsername(decoded);
        if (handle) {
          const url = request.nextUrl.clone();
          url.pathname = publicProfilePath(handle);
          return NextResponse.redirect(url, 308);
        }
      }
    }
  }

  // 1e. Legacy `?view=preview` article URLs redirect permanently to the plain
  // canonical article address, which already renders the preview server-side.
  const isArticle = ARTICLE_PATH.test(bare);
  const isAction = request.headers.has("next-action");
  if (
    isArticle &&
    !isAction &&
    request.method === "GET" &&
    request.nextUrl.searchParams.get(PREVIEW_PARAM) === PREVIEW_VALUE
  ) {
    const url = request.nextUrl.clone();
    url.searchParams.delete(PREVIEW_PARAM);
    return NextResponse.redirect(url, 308);
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
