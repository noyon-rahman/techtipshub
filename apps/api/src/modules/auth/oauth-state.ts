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
 */
const STATE_TTL = "10m";

export const createOAuthState = (redirect?: string) =>
  jwt.sign(
    { redirect: redirect ?? "/" },
    config.JWT_ACCESS_TOKEN_SECRET,
    { expiresIn: STATE_TTL as SignOptions["expiresIn"] },
  );

export const verifyOAuthState = (state: string): { redirect: string } => {
  const decoded = jwt.verify(
    state,
    config.JWT_ACCESS_TOKEN_SECRET,
  ) as { redirect?: string };

  return { redirect: decoded.redirect ?? "/" };
};
