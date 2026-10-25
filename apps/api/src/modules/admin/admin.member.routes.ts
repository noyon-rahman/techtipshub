import { Hono } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import { validate } from "../../middlewares";
import { commentController } from "../comment/comment.controller";
import { contactController } from "../contact/contact.controller";
import { contactValidationSchema } from "../contact/contact.validation";
import { userController } from "../user/user.controller";
import { adminCommentController } from "./admin.comment.controller";

const adminUserRouter = new Hono<TAppBindings>();

adminUserRouter.get("/", userController.getAllUsers);

// Literal path before "/:id" routes.
adminUserRouter.get("/trash", userController.getDeletedUsers);

adminUserRouter.patch("/:id/restore", userController.restoreUser);
adminUserRouter.patch("/:id/block", userController.blockUser);
adminUserRouter.patch("/:id/unblock", userController.unBlockUser);
adminUserRouter.patch("/:id/make-admin", userController.makeAdmin);
adminUserRouter.delete("/:id", userController.deleteUserAccount);

const adminCommentRouter = new Hono<TAppBindings>();

// Literal paths must stay above "/:id".
adminCommentRouter.get("/", commentController.getAll);
adminCommentRouter.get("/latest", commentController.getLatest);
adminCommentRouter.get("/counts", commentController.getCounts);

adminCommentRouter.delete("/:id", adminCommentController.deleteComment);

const adminMessageRouter = new Hono<TAppBindings>();

adminMessageRouter.get("/", contactController.getAll);
adminMessageRouter.get("/:id", contactController.getSingle);
adminMessageRouter.patch(
  "/:id/status",
  validate({ json: contactValidationSchema.updateStatus }),
  contactController.updateStatus,
);

export { adminUserRouter, adminCommentRouter, adminMessageRouter };
