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

/** Anything that is not this is a forged, expired or reused-start state. */
const START = "google";

export const createOAuthState = (redirect?: string) =>
  jwt.sign({ redirect: redirect ?? "/", started: START }, secret(), {
    expiresIn: STATE_TTL as SignOptions["expiresIn"],
  });

export const verifyOAuthState = (state: string): { redirect: string } => {
  const decoded = jwt.verify(state, secret()) as {
    redirect?: string;
    started?: string;
  };

  if (decoded.started !== START) {
    throw new Error("OAuth state was not issued by the sign-in start route");
  }

  return { redirect: decoded.redirect ?? "/" };
};
