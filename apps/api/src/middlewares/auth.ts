import httpStatus from "http-status";
import type { MiddlewareHandler } from "hono";
import jwt, { JwtPayload } from "jsonwebtoken";
import config from "../config";
import { AppError } from "../errors";
import type { TAppBindings } from "../interface/bindings";
import { TUserRole } from "../modules/user/user.interface";
import User from "../modules/user/user.model";

/**
 * Require a valid access token, optionally with one of `requiredRoles`.
 *
 * The caller is put on the context as `user`, which is what every handler
 * behind this reads. Faults are thrown as `AppError`, so the single error
 * handler decides the status and the body.
 */
const auth = (...requiredRoles: TUserRole[]): MiddlewareHandler<TAppBindings> => {
  return async (c, next) => {
    const token = c.req.header("authorization")?.split(" ")[1];
    if (!token) {
      throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized Access");
    }

    const decoded = jwt.verify(
      token,
      config.JWT_ACCESS_TOKEN_SECRET,
    ) as JwtPayload;

    const { email, role, iat } = decoded;

    const user = await User.findOne({ email: email });
    if (!user) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    if (user.isDeleted) {
      throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
    }

    if (user.status === "Blocked") {
      throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
    }

    if (
      user.passwordChangeAt &&
      User.isJWTIssuedBeforePasswordChanged(
        user.passwordChangeAt,
        iat as number,
      )
    ) {
      throw new AppError(
        httpStatus.FORBIDDEN,
        "Password has been changed. Please login again.",
      );
    }

    if (requiredRoles.length > 0 && !requiredRoles.includes(role)) {
      throw new AppError(httpStatus.FORBIDDEN, "Access Forbidden");
    }

    c.set("user", decoded as TAppBindings["Variables"]["user"]);
    await next();
  };
};

export default auth;
