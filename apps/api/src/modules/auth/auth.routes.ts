import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth, validate, withUploads } from "../../middlewares";
import { authAttemptLimit, mailLimit } from "../../middlewares/rateLimit";
import { authController } from "./auth.controller";
import { authValidationSchema } from "./auth.validation";

const authRoutes = new Hono<TAppBindings>();

// Signing up creates an account, so it is limited like signing in.
authRoutes.post(
  "/register",
  authAttemptLimit,
  withUploads({ field: "image", target: "profilePicture", resourceType: "auto" }),
  validate({ json: authValidationSchema.register }),
  authController.register,
);

authRoutes.post(
  "/login",
  authAttemptLimit,
  validate({ json: authValidationSchema.login }),
  authController.login,
);

/**
 * Google sign-in lives here rather than in the web app: the API holds the
 * client secret, exchanges the code, and sets the session cookies. The
 * redirect URI on the OAuth client is `<api>/auth/google/callback`.
 *
 * A member who already has a password can sign in with Google too: the two are
 * the same account, matched by Google's own account id first and by the
 * verified address for accounts that predate it.
 *
 * Only the start of the flow is limited: the callback is a redirect back from
 * Google, and refusing it would strand the browser on an error page.
 */
authRoutes.get("/google", authAttemptLimit, authController.googleStart);

authRoutes.get("/google/callback", authController.googleCallback);

/**
 * The site trading a Google handoff code for the session, server to server.
 * Limited like a sign-in, since it is one.
 */
authRoutes.post(
  "/session/claim",
  authAttemptLimit,
  validate({ json: authValidationSchema.claimSession }),
  authController.claimSession,
);

/**
 * The session, as the API sees it. The site calls this instead of decoding a
 * token, so it never has to know what an expiry or a role means.
 */
authRoutes.get("/session", authController.readSession);

authRoutes.post("/refresh-token", authController.generateNewAccessToken);

authRoutes.post("/logout", authController.logOut);

authRoutes.get("/me", auth(USER_ROLE.USER, USER_ROLE.ADMIN), authController.getMe);

authRoutes.put(
  "/change-password",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validate({ json: authValidationSchema.changePassword }),
  authController.changePassword,
);

// Both send mail, so both are limited well below the sign-in allowance: a
// script filling inboxes is cheaper for an attacker than guessing passwords.
authRoutes.post(
  "/forget-password",
  mailLimit,
  validate({ json: authValidationSchema.forgetPassword }),
  authController.forgetPassword,
);

authRoutes.post(
  "/reset-password",
  validate({ json: authValidationSchema.resetPassword }),
  authController.resetPassword,
);

export default authRoutes;
