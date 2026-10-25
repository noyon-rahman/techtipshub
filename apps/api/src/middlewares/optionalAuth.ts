import type { MiddlewareHandler } from "hono";
import jwt, { JwtPayload } from "jsonwebtoken";
import config from "../config";
import type { TAppBindings } from "../interface/bindings";
import User from "../modules/user/user.model";

/**
 * Attaches the decoded user to the context when a valid access token is sent,
 * and simply continues when it is missing or invalid.
 *
 * Use this on routes that must stay open to guests but behave differently for
 * signed-in users (e.g. a single article records a view for a member but not
 * for a guest, and a member's own article is excluded from their view count).
 * Never use it where a user is required — use the `auth()` middleware for that.
 */
const optionalAuth: MiddlewareHandler<TAppBindings> = async (c, next) => {
  const token = c.req.header("authorization")?.split(" ")[1];
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(
      token,
      config.JWT_ACCESS_TOKEN_SECRET,
    ) as JwtPayload;

    const user = await User.findOne({ email: decoded.email });
    if (!user || user.isDeleted || user.status === "Blocked") {
      return next();
    }

    c.set("user", decoded as TAppBindings["Variables"]["user"]);
  } catch {
    // An expired or malformed token just means "guest" on this route.
  }

  return next();
};

export default optionalAuth;
