/**
 * Why a Google sign-in did not finish.
 *
 * The API answers with one of these codes rather than a message, so the copy
 * lives here, next to the page that shows it, and the URL never carries a
 * server error's own text.
 */
export type TGoogleFailure =
  | "cancelled"
  | "no_code"
  | "state"
  | "not_configured"
  | "unverified"
  | "exchange_failed"
  | "profile_failed"
  | "account_deleted"
  | "account_blocked"
  | "account_conflict"
  | "unavailable";

const MESSAGES: Record<TGoogleFailure, string> = {
  cancelled:
    "Google sign-in was cancelled. You can try again whenever you are ready.",
  no_code:
    "Google did not send a sign-in code back. Start the sign-in again from this page.",
  state:
    "That Google sign-in took too long or was started somewhere else. Start it again from this page.",
  not_configured: "Google sign-in is not switched on for this site yet.",
  unverified:
    "Google has not verified the email address on that account, so it cannot be used to sign in here.",
  exchange_failed: "Google sign-in did not complete. Try again in a moment.",
  profile_failed:
    "Google signed you in but did not return your profile. Try again in a moment.",
  account_deleted:
    "The account linked to that Google sign-in has been deleted.",
  account_blocked:
    "That account has been blocked. Get in touch if you think that is wrong.",
  account_conflict:
    "That Google account is already linked to a different TechTipsHub account. Sign in with the Google account you used before, or reset your password on this address.",
  unavailable: "Google sign-in did not complete. Try again in a moment.",
};

const isGoogleFailure = (value: string | null): value is TGoogleFailure =>
  Boolean(value && value in MESSAGES);

/**
 * What to tell the reader about the Google sign-in they just came back from.
 *
 * Accepts the API's own codes, and the older `?error=` wording so a link that
 * was already sent or bookmarked still explains itself.
 */
export const googleFailureMessage = (
  code: string | null,
  legacyError?: string | null,
): string | undefined => {
  if (isGoogleFailure(code)) return MESSAGES[code];

  return legacyError || undefined;
};

/**
 * Where the reader goes once the sign-in has finished.
 *
 * The API has already chosen this from the state it signed, but it travels
 * through a query string, so it is checked here as well: the value must be a
 * path on this site, and never the protocol-relative `//host` form that a
 * browser reads as another domain.
 *
 * A bare `/` is returned for anything that fails the check, which sign-in and
 * signup both read as "go to the feed".
 */
export const googleRedirectPath = (value: string | null) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/";

export { MESSAGES as googleFailureMessages };
