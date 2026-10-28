import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import config from "../../config";

/**
 * The `state` that ties a Google callback to the sign-in that started it.
 *
 * A signed short-lived token rather than a random value in a cookie: the API
 * does not keep sessions in cookies, and the signature alone proves the value
 * came from this server, which is what stops a third party from handing back a
 * code that was meant for someone else.
 *
 * GOOGLE_STATE_SECRET is a key of its own so a value minted here can never be
 * replayed as an access token, or the other way round. Deployments that predate
 * the variable keep working on the access-token secret until they set it.
 */
const STATE_TTL = "10m";

const secret = () =>
  config.GOOGLE_STATE_SECRET ?? config.JWT_ACCESS_TOKEN_SECRET;

/** The leg of the sign-in the value was minted for. */
type TGooglePurpose = "start" | "handoff";

/**
 * A Google sign-in is two redirects across two sites: this API starts it and
 * ends it, and the site in between only carries the browser. Each leg carries
 * a value signed here.
 *
 * Both are stateless: a callback spends nothing, so a browser that reloads it
 * still signs in, and there is no temporary collection to expire.
 */
const sign = (payload: Record<string, string>, purpose: TGooglePurpose) =>
  jwt.sign({ ...payload, purpose }, secret(), {
    expiresIn: STATE_TTL as SignOptions["expiresIn"],
  });

const read = (value: string, purpose: TGooglePurpose): jwt.JwtPayload => {
  const decoded = jwt.verify(value, secret());

  if (typeof decoded === "string" || decoded.purpose !== purpose) {
    throw new Error(`Value was not minted for the Google ${purpose} step`);
  }

  return decoded;
};

export const createOAuthState = (redirect?: string) =>
  sign({ redirect: redirect ?? "/" }, "start");

export const verifyOAuthState = (state: string): { redirect: string } => {
  const decoded = read(state, "start");

  return { redirect: (decoded.redirect as string) ?? "/" };
};

/**
 * The code a Google callback hands to the site in the URL.
 *
 * The tokens travel inside the signed value, so the database keeps no session
 * copy, and the URL holds nothing that is usable on its own. The site trades
 * it for cookies within the TTL; after that the value, and the session in it,
 * expires like any other token.
 */
export const createHandoff = async (session: {
  accessToken: string;
  refreshToken: string;
}) => sign(session, "handoff");

export const claimHandoff = async (code: string) => {
  if (!code) return null;

  try {
    const decoded = read(code, "handoff");

    return {
      accessToken: decoded.accessToken as string,
      refreshToken: decoded.refreshToken as string,
    };
  } catch {
    return null;
  }
};
