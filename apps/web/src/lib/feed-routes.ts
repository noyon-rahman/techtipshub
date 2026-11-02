/**
 * The three places a reader can browse articles, and what each one means:
 *
 *   /            All.           Everything published, in the site's own order.
 *   /personalized Personalized. Signed in only; the reader's topics lead.
 *   /following   Following.     Signed in only; newest first, from the writers
 *                               the reader chose.
 *
 * The labels match these meanings, because a tab has to be true for everyone
 * who can see it. The rail, the phone row and the page headings all read these
 * constants, so a tab cannot end up pointing at another screen's path.
 */

/** The feed: every published article, and the site's front door. */
export const feedPath = "/";

/**
 * The reader's own list: the same articles, with the topics on the account
 * first. Signed in only, so the name is always earned.
 */
export const personalFeedPath = "/personalized";

/** Articles from the members the reader follows, newest first. */
export const followingPath = "/following";

/**
 * The paths for the two filtered views of the feed.
 *
 * The landing page is prerendered, and reading `?search=`/`?category=` there
 * would mean rendering it per request. So a filter is a real URL instead:
 *
 *   /search?q=<term>              articles matching a search term
 *   /categories/<category-name>   one category, newest first
 *
 * Both are their own routes, generated and cached like every other page.
 */

/** Categories whose name survives as a path segment unchanged. */
const isPlainName = (name: string) => /^[a-z0-9][a-z0-9-]*$/.test(name);

/** The slug a category is addressed by: its name, lowercased, hyphenated. */
export const categorySlug = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** The category's own URL, or the feed when the name cannot be a path. */
export const categoryPath = (name: string) => {
  const slug = categorySlug(name);
  return isPlainName(slug) && slug ? `/categories/${slug}` : feedPath;
};

/** Every category in one place, reachable from the feed's cards and links. */
export const categoriesPath = "/categories";

/** `/search?q=...`, or the feed when there is nothing to search for. */
export const searchPath = (term?: string | null) => {
  const trimmed = term?.trim();
  return trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : feedPath;
};
