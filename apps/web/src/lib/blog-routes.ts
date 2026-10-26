/**
 * The URLs of the account area and the article editor, in one place.
 *
 * The member's profile page (`/profile/@<handle>`) is also where the profile
 * is edited, so there is no separate settings address. The article screens sit
 * at the site root, beside the published article they are about, and share the
 * editor's own full-width frame rather than the account rail. The editor takes
 * one path shape:
 *
 *   /blogs/new              write a post
 *   /blogs/<slug>/edit      edit a post
 *
 * The edit address is the published article plus `/edit`, so a writer reads the
 * slug they already know. Anything that links to the editor goes through the
 * helpers here so the pair cannot drift apart.
 */

/** The article composer: `new` at the root, beside the article it creates. */
export const writeBlogPath = "/blogs/new";

export const editBlogPath = (slug: string) =>
  `/blogs/${encodeURIComponent(slug)}/edit`;

/** The signed-in member's article list. */
export const manageBlogsPath = "/profile/blogs";

/** A member's profile page: the public view, and the place to edit it. */
export const ownProfilePath = (username: string) =>
  `/profile/@${encodeURIComponent(username)}`;

/** The admin article list and one article's editor, by id. */
export const adminManageBlogsPath = "/admin/manage-blogs";

export const adminEditBlogPath = (id: string) =>
  `/admin/manage-blogs/${encodeURIComponent(id)}/edit`;

/**
 * Standalone routes that live beside the articles at the root. A slug never
 * resolves to one of these, so a published article cannot shadow "new".
 */
export const RESERVED_BLOG_SLUGS = ["new", "edit"] as const;

/**
 * `/profile` is the account area, so everything below it needs a session
 * (`proxy.ts` and `protectedRoutes` both read this list). That includes a
 * public profile page: it is the member's own view of it. The composer and the
 * editor are added on their own at the root, where everything else is public.
 */
export const PROTECTED_AREAS = ["/profile", writeBlogPath, manageBlogsPath];

/** Paths that still have to render while signed out. */
const OPEN_UNDER_PROFILE = new Set<string>();

/** Whether `pathname` may only be reached while signed in. */
export const requiresSession = (pathname: string) =>
  PROTECTED_AREAS.some(
    (area) => pathname === area || pathname.startsWith(`${area}/`),
  ) && !OPEN_UNDER_PROFILE.has(pathname);

/**
 * Where to send the writer after signing in, from a `?redirect=` value.
 *
 * Only same-origin paths are accepted; anything else falls back to the feed,
 * so a crafted link cannot bounce a member to another site. Accepts the
 * leading-slash form (`/blogs/new`) as well as the slash-less form used
 * by some of the older links (`blogs/slug`).
 */
export const safeRedirectPath = (raw: string | null | undefined) => {
  if (!raw) return "/";
  const path = raw.startsWith("/") ? raw : `/${raw}`;
  // Protocol-relative (`//evil.example`) is a different origin.
  if (path.startsWith("//")) return "/";
  return path;
};
