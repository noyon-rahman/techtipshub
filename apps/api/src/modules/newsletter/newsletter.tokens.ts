import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import config from "../../config";

/**
 * Links that must work months later, from any mail client, with no session.
 *
 * The token is a keyed hash of the address rather than a random value stored
 * per row: nothing has to be looked up before a signature is checked, so a
 * forged link is rejected without touching the database, and the link stays
 * valid for the life of the subscription. Pressing Unsubscribe twice, or a
 * mailbox prefetching the URL, lands on the same quiet result.
 *
 * The key can be its own secret, so a token from an email is not signed with
 * anything that also mints a session. When the variable is empty the key is
 * derived from the JWT secrets, which are at least as private and are already
 * required.
 */

const unsubscribeSecret = () =>
  config.NEWSLETTER_UNSUBSCRIBE_SECRET ||
  createHash("sha256")
    .update(
      `newsletter:${config.JWT_ACCESS_TOKEN_SECRET}:${config.JWT_REFRESH_TOKEN_SECRET}`,
    )
    .digest("hex");

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const sign = (email: string) =>
  createHmac("sha256", unsubscribeSecret())
    .update(`unsubscribe:${normalizeEmail(email)}`)
    .digest("base64url")
    .slice(0, 32);

const safeEqual = (a: string, b: string) => {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
};

export const unsubscribeToken = (email: string) => sign(email);

/** The address a token was made for, or `undefined` when it is forged. */
export const readUnsubscribeToken = (email: string, token: string) =>
  safeEqual(sign(email), token) ? normalizeEmail(email) : undefined;

const site = () => config.CLIENT_BASE_URL.replace(/\/$/, "");

/**
 * The opt-out address: the visible footer link, the `List-Unsubscribe` header
 * and Resend's own unsubscribe setting all point here. The address travels in
 * the query because a mailbox is not a signed-in reader.
 */
export const unsubscribeUrl = (email: string) => {
  const address = normalizeEmail(email);
  const query = new URLSearchParams({
    email: address,
    token: unsubscribeToken(address),
  });

  return `${site()}/unsubscribe?${query.toString()}`;
};

/**
 * Where Resend delivers bounce and complaint events. It is the API's own
 * address, because those events arrive server to server, never in a browser.
 */
export const resendWebhookUrl = () =>
  `${config.API_BASE_URL.replace(/\/$/, "")}/newsletter/webhook/resend`;
