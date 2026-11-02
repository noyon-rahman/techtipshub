/**
 * The URLs of the account area and the article editor, in one place.
 *
 * The member's profile page (`/profile`) is also where the profile is edited,
 * so there is no separate settings address. The article screens sit
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
 *
 * The two personal lists (`personalFeedPath`, `followingPath`) are declared in
 * `feed-routes.ts` beside the feed they belong to, and imported here only so
 * this file can list them as areas that need a session.
 */
import { followingPath, personalFeedPath } from "./feed-routes";

/** The article composer: `new` at the root, beside the article it creates. */
export const writeBlogPath = "/blogs/new";

export const editBlogPath = (slug: string) =>
  `/blogs/${encodeURIComponent(slug)}/edit`;

/** The signed-in member's article list. */
export const manageBlogsPath = "/profile/blogs";

/**
 * The signed-in member's own profile: the page, and the place to edit it.
 *
 * No handle in the address, because the page describes whoever holds the
 * session. The public address a reader sees is `publicProfilePath` below.
 */
export const ownProfilePath = "/profile";

/**
 * A member's public profile, as a reader or a search engine sees it.
 *
 * Separate from the address above because that one is the member's own view,
 * behind a session. This is the address the onboarding step promises, the one
 * the sitemap lists, and the one an old handle redirects to.
 */
export const publicProfilePath = (username: string) =>
  `/users/${encodeURIComponent(username)}`;

/** The admin article list and one article's editor, by id. */
export const adminManageBlogsPath = "/admin/manage-blogs";

export const adminEditBlogPath = (id: string) =>
  `/admin/manage-blogs/${encodeURIComponent(id)}/edit`;

/**
 * The admin composer: an article written for a member. It sits under the list
 * rather than at `/blogs/new`, so an admin writing for someone else never
 * lands in the member composer, which always makes the article your own.
 */
export const adminNewBlogPath = "/admin/manage-blogs/new";

/**
 * The welcome step, shown once after a first sign-in.
 *
 * It asks the one question a brand-new member can answer: what to read about.
 * `/welcome` frames that moment; the page is never shown again once answered.
 *
 * Deliberately not under `/profile`: that area is gated by `proxy.ts` on a
 * session check, and this page has to tell "signed out" from "not asked yet"
 * itself. It checks the session in the page and works out the saved answers in
 * a server action, the same way an article decides who is reading it.
 */
export const welcomePath = "/welcome";

/**
 * The username step: the first thing a new member is asked, because the handle
 * is the address every link to their profile will use.
 *
 * A step of its own rather than a second question on `/welcome`, so the two
 * onboarding prompts never stack on one screen, and a member who closes the tab
 * between them comes back to the one they left.
 */
export const usernameOnboardingPath = `${welcomePath}/username`;

/** Whether a welcome address is the username step (used to avoid a loop). */
export const isUsernameOnboardingPath = (path: string) =>
  path === usernameOnboardingPath;

/**
 * The step after the handle: the topics question, carrying the destination the
 * member signed in for. Whether they have already answered it is not known here
 * and does not need to be: `/welcome` checks and sends them straight on.
 */
export const afterUsernamePath = (destination: string) =>
  `${welcomePath}?next=${encodeURIComponent(destination)}`;

/**
 * Where signing in lands.
 *
 * Username first, topics second, then the page the reader was sent to. A member
 * who has answered the handle step but not the interests one is not sent back
 * to the handle, and a member who has answered both goes straight through.
 */
export const afterSignInPath = (
  destination: string,
  state: { onboarded: boolean; interestsAnswered: boolean },
) => {
  if (!state.onboarded) {
    return `${usernameOnboardingPath}?next=${encodeURIComponent(destination)}`;
  }

  return state.interestsAnswered
    ? destination
    : `${welcomePath}?next=${encodeURIComponent(destination)}`;
};

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
 *
 * The two personal lists are here for the same reason: `/personalized` and
 * `/following` are built from the reader's own account, so without a session
 * there is nothing for them to show.
 */
export const PROTECTED_AREAS = [
  "/profile",
  welcomePath,
  writeBlogPath,
  manageBlogsPath,
  personalFeedPath,
  followingPath,
];

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
