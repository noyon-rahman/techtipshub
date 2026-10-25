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

export interface IGoogleProfile {
  email: string;
  name: string;
  picture?: string;
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

/** Swap the code Google returned for the account behind it. */
export const fetchGoogleProfile = async (code: string) => {
  const tokenRes = await fetch(TOKEN_URL, {
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

  if (!tokenRes.ok) {
    throw new Error(`Google token exchange failed (${tokenRes.status})`);
  }

  const { access_token } = (await tokenRes.json()) as {
    access_token?: string;
  };

  if (!access_token) {
    throw new Error("Google token exchange returned no access token");
  }

  const userRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) {
    throw new Error(`Google profile request failed (${userRes.status})`);
  }

  const profile = (await userRes.json()) as {
    email?: string;
    name?: string;
    picture?: string;
    email_verified?: boolean;
  };

  // Signing in by an address Google itself has not verified would let an
  // unverified mailbox take over an account registered with a password.
  if (!profile.email || profile.email_verified === false) {
    throw new Error("Google account has no verified email address");
  }

  return {
    email: profile.email,
    name: profile.name || profile.email.split("@")[0],
    picture: profile.picture,
  } satisfies IGoogleProfile;
};
