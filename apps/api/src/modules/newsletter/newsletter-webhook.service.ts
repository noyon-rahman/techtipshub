import { createHmac, timingSafeEqual } from "node:crypto";
import httpStatus from "http-status";
import config from "../../config";
import AppError from "../../errors/AppError";
import { subscriberService } from "./newsletter-subscriber.service";

/**
 * Resend signs webhooks with Svix. The signature covers the id, the timestamp
 * and the raw body joined by dots, so the body must be verified exactly as it
 * arrived: parsing first and re-serialising would change the bytes and fail
 * every genuine call.
 *
 * The timestamp is also checked, so a captured request cannot be replayed
 * after the fact.
 */
const TOLERANCE_SECONDS = 5 * 60;

type TSvixHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

const signatureParts = (header: string) =>
  header
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));

export const verifyResendSignature = (
  raw: string,
  headers: TSvixHeaders,
): boolean => {
  const secret = config.RESEND_WEBHOOK_SECRET;
  if (!secret) return false;

  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp)) return false;

  const age = Math.abs(Date.now() / 1000 - timestamp);
  if (age > TOLERANCE_SECONDS) return false;

  // `whsec_` is the form Resend shows; the key itself is the part after it.
  const key = secret.startsWith("whsec_")
    ? secret.slice("whsec_".length)
    : secret;
  const expected = createHmac("sha256", Buffer.from(key, "base64"))
    .update(`${headers.id}.${headers.timestamp}.${raw}`)
    .digest("base64");

  const given = signatureParts(headers.signature);
  if (given.length === 0) return false;

  const expectedBuffer = Buffer.from(expected);
  return given.some((candidate) => {
    const buffer = Buffer.from(candidate);
    return (
      buffer.length === expectedBuffer.length &&
      timingSafeEqual(buffer, expectedBuffer)
    );
  });
};

type TResendEvent = {
  type?: string;
  data?: { to?: string[] | string; email?: string };
};

/** The addresses an event is about, from whichever field this event uses. */
const addressesOf = (event: TResendEvent) => {
  const to = event.data?.to;
  const list = Array.isArray(to) ? to : typeof to === "string" ? [to] : [];
  const email = event.data?.email;
  return [...list, ...(typeof email === "string" ? [email] : [])];
};

/**
 * What a bounce or a complaint does to the list.
 *
 * Both stop mail for that address for good. Resend already suppresses it on
 * its side, but the list here is the one the campaign queue reads, so the
 * state has to live here too. Other event types are acknowledged and ignored.
 */
const handleResendEvent = async (event: TResendEvent) => {
  const type = event.type ?? "";

  const reason =
    type === "email.bounced"
      ? ("bounced" as const)
      : type === "email.complained"
        ? ("complained" as const)
        : undefined;

  if (!reason) return { handled: false, type };

  const addresses = addressesOf(event)
    .map((address) => address.trim())
    .filter(Boolean);
  if (addresses.length === 0) return { handled: false, type };

  const results = [];
  for (const address of addresses) {
    results.push(await subscriberService.suppress(address, reason));
  }

  return {
    handled: true,
    type,
    changed: results.some((result) => result.changed),
  };
};

export const requireWebhookSecret = () => {
  if (!config.RESEND_WEBHOOK_SECRET) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Webhooks are not configured on this server.",
    );
  }
};

export const resendWebhook = { verifyResendSignature, handleResendEvent };
