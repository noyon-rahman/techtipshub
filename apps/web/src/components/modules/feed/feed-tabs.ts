import { feedPath, followingPath, personalFeedPath } from "@/lib/feed-routes";

export interface IFeedTab {
  href: string;
  /** The name the rail, the phone row and the page heading all use. */
  label: string;
  /**
   * Built from the reader's own account, so it is drawn only when a session
   * can open it. A tab nobody can use is not a tab.
   */
  requiresSession: boolean;
}

/**
 * The three lists, in the order they are shown.
 *
 * `All` is everything published, in the site's own order, and it is the one
 * every visitor has. `Personalized` is the same list built from the reader's
 * topics at `/personalized`, and `Following` is the writers they chose: both
 * read the account, so they appear once there is a session.
 *
 * Each name says which articles are in the list and in what order, so the tab
 * can be believed at a glance. A signed-out reader gets `All` alone, which is
 * the only list that holds anything for them.
 */
export const feedTabs: IFeedTab[] = [
  { href: feedPath, label: "All", requiresSession: false },
  { href: personalFeedPath, label: "Personalized", requiresSession: true },
  { href: followingPath, label: "Following", requiresSession: true },
];

/** The tabs a visitor can use. `null` is "the session has not answered yet". */
export const visibleFeedTabs = (signedIn: boolean | null) =>
  signedIn === null
    ? [feedTabs[0]]
    : feedTabs.filter((tab) => !tab.requiresSession || signedIn);
