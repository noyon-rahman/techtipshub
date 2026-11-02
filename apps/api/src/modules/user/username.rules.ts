import { addDays, format } from "date-fns";

/**
 * The handle change rules: how long a change is locked, how long an old handle
 * stays reserved, and what "the same handle" means.
 *
 * Kept apart from the service so the refusal message, the date a profile shows
 * and the redirect's lifetime are all read from the same numbers.
 */

/** Every change commits the member to this window before the next one. */
export const USERNAME_CHANGE_LOCK_DAYS = 30;

/**
 * How long a handle stays reserved after it is given up.
 *
 * One year covers a season of links, bookmarks and search results pointing at
 * the old address, and is long enough that the ranking it earned has been
 * re-earned at the new one. After that it frees up, so the namespace does not
 * fill with handles nobody can ever use again.
 */
export const USERNAME_RESERVATION_DAYS = 365;

export const usernameLockEndsAt = (changedAt: Date) =>
  addDays(changedAt, USERNAME_CHANGE_LOCK_DAYS);

export const usernameReservationEndsAt = (from: Date) =>
  addDays(from, USERNAME_RESERVATION_DAYS);

/** The date a member reads in a refusal or on the locked field. */
export const formatUsernameDate = (date: Date) => format(date, "d MMM yyyy");

/**
 * Whether `next` counts as a change from `current`.
 *
 * Compared case-insensitively: the API stores a handle lowercased, so a member
 * who types `Ada` is asking for the handle they already hold. Whitespace is
 * trimmed for the same reason.
 */
export const isUsernameChange = (current: string, next: string) =>
  current.trim().toLowerCase() !== next.trim().toLowerCase();
