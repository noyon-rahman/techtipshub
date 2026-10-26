import { randomUUID } from "node:crypto";
import env, { isEmailConfigured } from "../config";
import {
  MAIL_REPLY_TO,
  MAIL_SENDERS,
  type TMailSenderKey,
} from "../config/mail";

export { isEmailConfigured };

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 5_000;

export type TMailAddress = {
  name?: string;
  address: string;
};

export type TSendEmail = {
  to: TMailAddress;
  subject: string;
  /** One of `text` or `html` is required; sending both is best. */
  text?: string;
  html?: string;
  /** Which address on the verified domain the mail is sent as. */
  sender?: TMailSenderKey;
  /** Where a reply goes. Defaults to the support mailbox. */
  replyTo?: TMailAddress;
  /** Label shown in the Resend dashboard, so deliveries can be found. */
  category?: string;
  /**
   * Reused across retries automatically. Pass a stable value to make two
   * calls deduplicate as well (Resend keeps keys for 24 hours).
   */
  idempotencyKey?: string;
  /**
   * When true, a failed send rejects instead of being logged and swallowed.
   * Flows that must not claim a delivery set this.
   */
  throwOnError?: boolean;
  /**
   * RFC 8058 one-click opt-out, sent as the `List-Unsubscribe` and
   * `List-Unsubscribe-Post` pair. Gmail and Apple Mail then draw their own
   * button next to the sender name, which is the opt-out readers trust most.
   * Only campaigns carry it: account mail has no list to leave.
   */
  unsubscribeUrl?: string;
};

type TResendError = {
  name?: string;
  message?: string;
};

type TResendResult = {
  id?: string;
};

export class MailDeliveryError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryable = false,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "MailDeliveryError";
  }
}

/** A display name is data, never a place to smuggle another header. */
const displayName = (name: string) => name.replace(/[\r\n]+/g, " ").trim();

const formatAddress = ({ name, address }: TMailAddress) => {
  const clean = address.replace(/[\r\n<>]+/g, "").trim();
  const label = name ? displayName(name) : "";

  return label ? `${label} <${clean}>` : clean;
};

const retryAfterMs = (header: string | null) => {
  if (!header) return undefined;

  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
};

const backoffMs = (attempt: number) =>
  Math.min(BASE_RETRY_DELAY_MS * 2 ** (attempt - 1), MAX_RETRY_DELAY_MS);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const postToResend = async (
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<TResendResult> => {
  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const raw = await response.text();
  let body: TResendError | TResendResult | null;

  try {
    body = raw ? (JSON.parse(raw) as TResendError | TResendResult) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const detail = (body as TResendError | null)?.message ?? raw.slice(0, 200);

    throw new MailDeliveryError(
      `Resend rejected the message (${response.status})${
        detail ? `: ${detail}` : ""
      }`,
      response.status,
      response.status === 429 || response.status >= 500,
      retryAfterMs(response.headers.get("retry-after")),
    );
  }

  return (body as TResendResult | null) ?? {};
};

const sendEmail = async ({
  to,
  subject,
  text,
  html,
  sender = "hello",
  replyTo,
  category,
  idempotencyKey,
  throwOnError = false,
  unsubscribeUrl,
}: TSendEmail): Promise<TResendResult | undefined> => {
  if (!isEmailConfigured()) {
    const error = new MailDeliveryError(
      "Email delivery is not configured: RESEND_API_KEY is empty.",
    );

    if (throwOnError) throw error;

    // eslint-disable-next-line no-console
    console.error(`[mail] ${error.message}`);
    return undefined;
  }

  if (!text && !html) {
    const error = new MailDeliveryError(
      "A message needs a text or an html body.",
    );

    if (throwOnError) throw error;

    // eslint-disable-next-line no-console
    console.error(`[mail] ${error.message}`);
    return undefined;
  }

  const from = MAIL_SENDERS[sender];

  const payload = {
    from: formatAddress(from),
    to: [formatAddress(to)],
    subject: subject.replace(/[\r\n]+/g, " ").trim(),
    ...(text ? { text } : {}),
    ...(html ? { html } : {}),
    reply_to: formatAddress(
      replyTo ?? { name: MAIL_SENDERS.support.name, address: MAIL_REPLY_TO },
    ),
    ...(category ? { tags: [{ name: "category", value: category }] } : {}),
    ...(unsubscribeUrl
      ? {
          headers: {
            "List-Unsubscribe": `<${unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        }
      : {}),
  };

  // One key for this call and every retry of it: if Resend accepted the first
  // request but the response was lost, the retry is not a second delivery.
  const key = idempotencyKey ?? randomUUID();

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const result = await postToResend(payload, key);

      // eslint-disable-next-line no-console
      console.info(
        `[mail] sent ${category ?? "transactional"} to ${to.address} (id ${result.id ?? "unknown"})`,
      );

      return result;
    } catch (error) {
      lastError = error;

      // A rejected request (bad address, unverified domain) will fail the same
      // way every time. Only upstream trouble and network faults are retried.
      const retryable =
        error instanceof MailDeliveryError ? error.retryable : true;

      if (!retryable || attempt === MAX_ATTEMPTS) break;

      const wait =
        (error instanceof MailDeliveryError ? error.retryAfterMs : undefined) ??
        backoffMs(attempt) + Math.floor(Math.random() * 250);

      await sleep(wait);
    }
  }

  // eslint-disable-next-line no-console
  console.error(`[mail] delivery to ${to.address} failed:`, lastError);

  if (throwOnError) throw lastError;

  return undefined;
};

export default sendEmail;
