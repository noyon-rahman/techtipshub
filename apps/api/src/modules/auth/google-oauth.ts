import config from "../../config";

/**
 * The Google OAuth 2.0 endpoints this app calls.
 *
 * The flow is the authorization-code kind: the browser is sent to Google with
 * the client id and a one-time `state`, Google sends it back to the API with a
 * code, and that code is exchanged server-side for the account's profile. No
 * token of Google's ever reaches the browser.
 */
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

/**
 * Google answers in milliseconds; a request that hangs past this is a symptom,
 * not a wait worth passing on to someone watching a spinner after sign-in.
 */
const REQUEST_TIMEOUT_MS = 10_000;

export interface IGoogleProfile {
  /** Google's stable id for the account. Never changes when the email does. */
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * A Google call failed. `reason` is what the callback turns into a message;
 * the raw detail stays in `message` for the server log.
 */
export class GoogleAuthError extends Error {
  constructor(
    public readonly reason: "exchange_failed" | "profile_failed" | "unverified",
    message: string,
  ) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

/**
 * The address Google sends the browser back to. It has to match the URI on the
 * OAuth client exactly, so GOOGLE_REDIRECT_URI wins when set; otherwise it is
 * the API's own base plus the callback path.
 */
export const googleRedirectUri = () =>
  config.GOOGLE_REDIRECT_URI ?? `${config.API_BASE_URL}/auth/google/callback`;

export const isGoogleOAuthConfigured = () =>
  Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);

/** Where Google is sent, and what it is allowed to return. */
export const buildGoogleAuthorizeUrl = (state: string) => {
  const url = new URL(AUTHORIZE_URL);

  url.searchParams.set("client_id", config.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  // `online` asks for no refresh token; the session is this app's own JWT.
  url.searchParams.set("access_type", "online");
  url.searchParams.set("prompt", "select_account");

  return url.toString();
};

/**
 * One JSON request to Google, with the body's own `error` description folded
 * into the failure so the log says why instead of just which status.
 */
const requestGoogle = async (url: string, init: Parameters<typeof fetch>[1]) => {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    // Google describes a failure in the body; the token endpoint's own error
    // codes are more use in a log than "Bad Request", so read the body first.
    // `invalid_grant` only says "Bad Request", so the code is kept alongside it.
    const body = (await response.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;
    const code = typeof body.error === "string" ? body.error : undefined;
    const description =
      typeof body.error_description === "string"
        ? body.error_description
        : undefined;

    throw new Error(
      [code, description].filter(Boolean).join(": ") || `HTTP ${response.status}`,
    );
  }

  return (await response.json()) as Record<string, unknown>;
};

/** Swap the code Google returned for the account behind it. */
export const fetchGoogleProfile = async (code: string) => {
  let token: Record<string, unknown>;

  try {
    token = await requestGoogle(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.GOOGLE_CLIENT_ID,
        client_secret: config.GOOGLE_CLIENT_SECRET,
        redirect_uri: googleRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
  } catch (error) {
    throw new GoogleAuthError(
      "exchange_failed",
      `Google token exchange failed: ${(error as Error).message}`,
    );
  }

  const accessToken = token.access_token;

  if (typeof accessToken !== "string" || !accessToken) {
    throw new GoogleAuthError(
      "exchange_failed",
      "Google token exchange returned no access token",
    );
  }

  let profile: Record<string, unknown>;

  try {
    profile = await requestGoogle(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error) {
    throw new GoogleAuthError(
      "profile_failed",
      `Google profile request failed: ${(error as Error).message}`,
    );
  }

  const email = typeof profile.email === "string" ? profile.email : undefined;
  const sub = typeof profile.sub === "string" ? profile.sub : undefined;

  // Signing in by an address Google itself has not verified would let an
  // unverified mailbox take over an account registered with a password.
  if (!email || profile.email_verified === false) {
    throw new GoogleAuthError(
      "unverified",
      "Google account has no verified email address",
    );
  }

  // Without an id there is nothing to link the account to across sign-ins, and
  // matching on the address alone is the weaker check this exists to avoid.
  if (!sub) {
    throw new GoogleAuthError(
      "profile_failed",
      "Google profile carried no account id (sub claim)",
    );
  }

  return {
    sub,
    email,
    name:
      (typeof profile.name === "string" && profile.name) ||
      email.split("@")[0],
    picture: typeof profile.picture === "string" ? profile.picture : undefined,
  } satisfies IGoogleProfile;
};
