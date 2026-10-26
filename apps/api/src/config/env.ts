import { z } from "zod";

// Parsed on import, so a bad value stops the boot instead of the first request
// that needs it. Where the values come from differs by host: the scripts pass
// a local `.env` with `--env-file`, and Vercel puts the project's variables
// straight into `process.env`.

const required = (name: string) =>
  z
    .string({ error: `${name} is required` })
    .trim()
    .min(1, `${name} is required`);

const url = (name: string) =>
  required(name).pipe(
    z.url({ protocol: /^https?$/, error: `${name} must be a valid http(s) URL` }),
  );

const positiveInt = (name: string) =>
  required(name)
    .regex(/^\d+$/, `${name} must be a whole number`)
    .transform(Number)
    .refine((value) => value > 0, `${name} must be greater than 0`);

const port = (name: string) =>
  positiveInt(name).refine(
    (value) => value <= 65535,
    `${name} must be 65535 or less`,
  );

// A blank entry means the feature is off.
const optionalString = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

const optionalEmail = (name: string) =>
  optionalString.pipe(z.email(`${name} must be an email address`).optional());

const domain = (name: string, fallback: string) =>
  z
    .string()
    .trim()
    .default(fallback)
    .pipe(
      z
        .string()
        .regex(
          /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i,
          `${name} must be a domain name, without a protocol or path`,
        ),
    );

const envSchema = z.object({
  // app
  NODE_ENV: z
    .enum(["development", "test", "production"], {
      error: 'NODE_ENV must be "development", "test" or "production"',
    })
    .default("development"),
  PORT: port("PORT"),
  API_BASE_URL: url("API_BASE_URL"),
  CLIENT_BASE_URL: url("CLIENT_BASE_URL"),
  DATABASE_URL: required("DATABASE_URL"),
  /**
   * Whether `x-forwarded-for` may be believed when identifying a client.
   *
   * True in production, where the host's proxy sets it. Turn it off anywhere
   * the process is reachable directly, or a caller can claim any address and
   * step around the rate limits.
   */
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),

  // jwt
  JWT_ACCESS_TOKEN_SECRET: required("JWT_ACCESS_TOKEN_SECRET"),
  JWT_REFRESH_TOKEN_SECRET: required("JWT_REFRESH_TOKEN_SECRET"),
  JWT_RESET_PASSWORD_SECRET: required("JWT_RESET_PASSWORD_SECRET"),
  JWT_ACCESS_TOKEN_EXPIRES_IN: required("JWT_ACCESS_TOKEN_EXPIRES_IN"),
  JWT_REFRESH_TOKEN_EXPIRES_IN: required("JWT_REFRESH_TOKEN_EXPIRES_IN"),
  JWT_RESET_PASSWORD_EXPIRES_IN: required("JWT_RESET_PASSWORD_EXPIRES_IN"),
  /** Long enough to find the mail without leaving the link usable for days. */
  JWT_VERIFY_EMAIL_EXPIRES_IN: z.string().trim().min(1).default("24h"),

  // mail, off until RESEND_API_KEY is set
  RESEND_API_KEY: optionalString,
  /**
   * The sending domain, verified in Resend. Every sender address is built from
   * it, so moving to another domain is one variable rather than one per
   * address.
   */
  MAIL_DOMAIN: domain("MAIL_DOMAIN", "techtipshub.noyonrahman.com"),
  /**
   * Where a reply to our mail goes. A send that does not name its own
   * reply address uses this one, so it must be a mailbox someone reads.
   */
  MAIL_REPLY_TO: optionalEmail("MAIL_REPLY_TO"),
  /** Where contact-form submissions are delivered. */
  CONTACT_INBOX: optionalEmail("CONTACT_INBOX"),
  /**
   * Signs the one-click unsubscribe link inside `List-Unsubscribe`, the header
   * Gmail and Apple Mail read. Empty derives a key from the JWT secrets.
   */
  NEWSLETTER_UNSUBSCRIBE_SECRET: optionalString,
  /**
   * Resend webhook signing secret (`whsec_…`). Empty means the endpoint that
   * turns bounces and complaints into suppressions refuses every call.
   */
  RESEND_WEBHOOK_SECRET: optionalString,
  /**
   * Bearer token Vercel Cron sends to `/api/v1/newsletter/cron`. Empty means
   * the endpoint refuses every call, so a campaign only moves when an admin
   * presses "Continue".
   */
  CRON_SECRET: optionalString,

  // hashing
  BCRYPT_SALT_ROUND: positiveInt("BCRYPT_SALT_ROUND"),

  // google sign-in, off when empty
  GOOGLE_CLIENT_ID: z.string().trim().default(""),
  GOOGLE_CLIENT_SECRET: z.string().trim().default(""),
  // Must match the URI registered on the OAuth client byte for byte. Empty
  // falls back to <API_BASE_URL>/auth/google/callback.
  GOOGLE_REDIRECT_URI: optionalString.pipe(
    z
      .url({
        protocol: /^https?$/,
        error: "GOOGLE_REDIRECT_URI must be a valid http(s) URL",
      })
      .optional(),
  ),
  // Signs the one-time `state` that starts a Google sign-in. A key of its own
  // keeps a value one endpoint hands out from being usable as a session token.
  GOOGLE_STATE_SECRET: optionalString,

  // rate limits. Tuned per environment; the defaults suit a small site.
  /**
   * Sign-in and password-reset attempts one address may make per window.
   * A real member never comes close; a password-guessing script hits it fast.
   */
  AUTH_RATE_LIMIT_MAX: positiveInt("AUTH_RATE_LIMIT_MAX").default(15),
  AUTH_RATE_LIMIT_WINDOW_MINUTES:
    positiveInt("AUTH_RATE_LIMIT_WINDOW_MINUTES").default(15),

  // cloudinary
  CLOUDINARY_CLOUD_NAME: required("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: required("CLOUDINARY_API_KEY"),
  CLOUDINARY_API_SECRET: required("CLOUDINARY_API_SECRET"),
})
// Half a pair passes an "is it set?" check, then fails at the first use.
.superRefine((value, ctx) => {
  if (Boolean(value.GOOGLE_CLIENT_ID) !== Boolean(value.GOOGLE_CLIENT_SECRET)) {
    ctx.addIssue({
      code: "custom",
      message:
        "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set, or both be empty",
    });
  }
});

export type TEnv = z.output<typeof envSchema>;

const problemsOf = (error: z.ZodError) =>
  error.issues
    .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("\n");

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = problemsOf(parsed.error);

  // Nothing else is running yet, and this must show at every log level.
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${problems}`);

  // A server of our own stops here, at boot, where the message can be read.
  // In a Vercel Function there is no boot to stop: exiting while the module is
  // loaded kills the request that loaded it, and every one after it reads as
  // FUNCTION_INVOCATION_FAILED with no reason in it. The throw is caught by the
  // app's error handler and answered with the same 500, once the log above
  // says which variables to fix.
  if (process.env.VERCEL) {
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  process.exit(1);
}

export const env = parsed.data;

export const isEmailConfigured = () => Boolean(env.RESEND_API_KEY);

export default env;
