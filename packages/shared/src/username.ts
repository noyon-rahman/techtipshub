/**
 * What a username is, in one place.
 *
 * A handle appears in the public profile address (`/users/<handle>`), so the
 * suggestion the onboarding step prefills, the one Google signup invents, the
 * rule the API enforces and the message a validation failure carries all have
 * to agree. They agree here rather than in four copies that drift.
 *
 * Plain functions with no imports, so the API, the site and the browser can all
 * read the same file.
 */

/** The rule the API enforces, as the sentence a form shows. */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/** The one character class a handle may use after normalising. */
export const USERNAME_PATTERN = /^[a-z0-9_]+$/;

/**
 * Handles nobody may hold: the site's own name and addresses, and words that
 * would read as an official voice on a profile page or in a comment. Compared
 * lowercased, since a handle is stored lowercased too.
 */
export const RESERVED_USERNAMES: readonly string[] = [
  "admin",
  "administrator",
  "api",
  "blog",
  "blogs",
  "contact",
  "help",
  "login",
  "logout",
  "moderator",
  "official",
  "profile",
  "root",
  "signup",
  "staff",
  "support",
  "system",
  "techtipshub",
  "team",
  "user",
  "users",
  "welcome",
];

/**
 * The first path segment of every route the site serves at the root. A handle
 * is never printed there today (profiles live under `/users`), but a reserved
 * word is one line of insurance against the day one is, and it is cheaper than
 * a migration afterwards.
 */
const ROUTE_SEGMENTS: readonly string[] = [
  "about",
  "admin",
  "blogs",
  "categories",
  "community-guidelines",
  "contact",
  "cookie",
  "disclaimer",
  "features",
  "following",
  "forget-password",
  "login",
  "new",
  "privacy",
  "profile",
  "refund-policy",
  "reset-password",
  "search",
  "signup",
  "sitemap.xml",
  "terms",
  "unsubscribe",
  "users",
  "welcome",
  "you",
];

const RESERVED = new Set([...RESERVED_USERNAMES, ...ROUTE_SEGMENTS]);

export const isReservedUsername = (value: string) =>
  RESERVED.has(value.trim().toLowerCase());

/**
 * A name, an address or a typed handle to the handle it becomes.
 *
 * Lowercase and diacritics stripped (`Ådá Lovelace` reads as `ada_lovelace`,
 * which is what someone searching for the name will type), spaces and every
 * other separator to one underscore, repeats collapsed, trimmed to 30 without
 * ending on the underscore that trimming may have exposed.
 *
 * It can return "" for input with nothing usable in it (`··`), which the caller
 * answers with a fallback of its own rather than this function inventing one.
 */
export const normaliseUsername = (input: string): string =>
  input
    .normalize("NFKD")
    // The combining marks NFKD split off: `é` is `e` plus one, and the mark is
    // what a URL cannot read.
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/_+$/, "");

/**
 * Whether `value` is a handle the API accepts, ignoring availability.
 *
 * Availability is never decided here: only a database read knows that, and this
 * runs in the browser too.
 */
export const isUsernameShape = (value: string): boolean =>
  value.length >= USERNAME_MIN_LENGTH &&
  value.length <= USERNAME_MAX_LENGTH &&
  USERNAME_PATTERN.test(value);

/** Why `value` is not a handle, or `null` when it is one. */
export const usernameProblem = (value: string): string | null => {
  if (!value) return "Choose a username";
  if (value.length < USERNAME_MIN_LENGTH)
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters`;
  if (value.length > USERNAME_MAX_LENGTH)
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters`;
  if (!USERNAME_PATTERN.test(value))
    return "Username can only use lowercase letters, numbers and underscores";
  if (isReservedUsername(value)) return "That username is reserved";
  return null;
};

/**
 * The handle to offer a member, before availability is known.
 *
 * The full name first, then the address's local part, then "member": a form
 * that opens on an empty field asks a question the site can already answer.
 * A name that normalises to something too short (`Li`) is padded rather than
 * refused, so the offer is always a valid handle.
 */
export const suggestUsername = (
  fullName: string,
  email?: string | null,
): string => {
  const fromName = normaliseUsername(fullName ?? "");
  const fromEmail = normaliseUsername((email ?? "").split("@")[0] ?? "");
  const base = fromName.length >= USERNAME_MIN_LENGTH ? fromName : fromEmail;

  if (base.length >= USERNAME_MIN_LENGTH) {
    return isReservedUsername(base) ? `${base}_` : base;
  }

  return "member";
};

/**
 * `base` with the smallest free numeric suffix, given what is taken.
 *
 * The taken test is the caller's: the database holds the real answer, and this
 * keeps the loop identical on both sides of it. A suffix is dropped back into
 * the final handle, so `ada_lovelace2` is tried before `ada_lovelace2` past 30
 * characters is ever built.
 */
export const usernameWithSuffix = (base: string, taken: number): string => {
  if (taken === 0) return base;

  const suffix = String(taken);
  const room = USERNAME_MAX_LENGTH - suffix.length;
  const trimmed = base.slice(0, Math.max(USERNAME_MIN_LENGTH, room)).replace(
    /_+$/,
    "",
  );

  return `${trimmed}${suffix}`;
};
