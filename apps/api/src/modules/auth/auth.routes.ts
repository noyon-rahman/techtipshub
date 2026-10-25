import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth, validateRequest, withUploads } from "../../middlewares";
import { authController } from "./auth.controller";
import { authValidationSchema } from "./auth.validation";

const authRoutes = new Hono<TAppBindings>();

authRoutes.post(
  "/register",
  withUploads({ field: "image", target: "profilePicture", resourceType: "auto" }),
  validateRequest(authValidationSchema.register),
  authController.register,
);

authRoutes.post("/login", validateRequest(authValidationSchema.login), authController.login);

authRoutes.post(
  "/social-login",
  validateRequest(authValidationSchema.socialLogin),
  authController.socialLogin,
);

authRoutes.post(
  "/refresh-token",
  validateRequest(authValidationSchema.refreshToken),
  authController.generateNewAccessToken,
);

authRoutes.get("/me", auth(USER_ROLE.USER, USER_ROLE.ADMIN), authController.getMe);

authRoutes.put(
  "/change-password",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validateRequest(authValidationSchema.changePassword),
  authController.changePassword,
);

authRoutes.post(
  "/forget-password",
  validateRequest(authValidationSchema.forgetPassword),
  authController.forgetPassword,
);

authRoutes.post(
  "/reset-password",
  validateRequest(authValidationSchema.resetPassword),
  authController.resetPassword,
);

export default authRoutes;
