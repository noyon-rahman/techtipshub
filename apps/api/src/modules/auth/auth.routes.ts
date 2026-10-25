import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth, validate, withUploads } from "../../middlewares";
import { authController } from "./auth.controller";
import { authValidationSchema } from "./auth.validation";

const authRoutes = new Hono<TAppBindings>();

authRoutes.post(
  "/register",
  withUploads({ field: "image", target: "profilePicture", resourceType: "auto" }),
  validate({ json: authValidationSchema.register }),
  authController.register,
);

authRoutes.post("/login", validate({ json: authValidationSchema.login }), authController.login);

authRoutes.post(
  "/social-login",
  validate({ json: authValidationSchema.socialLogin }),
  authController.socialLogin,
);

/**
 * Google sign-in lives here rather than in the web app: the API holds the
 * client secret, exchanges the code, and sets the session cookies. The
 * redirect URI on the OAuth client is `<api>/auth/google/callback`.
 */
authRoutes.get("/google", authController.googleStart);

authRoutes.get("/google/callback", authController.googleCallback);

authRoutes.post(
  "/refresh-token",
  validate({ cookie: authValidationSchema.refreshToken }),
  authController.generateNewAccessToken,
);

authRoutes.get("/me", auth(USER_ROLE.USER, USER_ROLE.ADMIN), authController.getMe);

authRoutes.put(
  "/change-password",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validate({ json: authValidationSchema.changePassword }),
  authController.changePassword,
);

authRoutes.post(
  "/forget-password",
  validate({ json: authValidationSchema.forgetPassword }),
  authController.forgetPassword,
);

authRoutes.post(
  "/reset-password",
  validate({ json: authValidationSchema.resetPassword }),
  authController.resetPassword,
);

export default authRoutes;
