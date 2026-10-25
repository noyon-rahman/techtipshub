import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth, validateRequest, withUploads } from "../../middlewares";
import { commentController } from "./comment.controller";
import { commentValidationSchema } from "./comment.validation";

const commentRouter = new Hono<TAppBindings>();

// Listing and moderation live under "/admin/comments".

commentRouter.delete(
  "/:id",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  commentController.deleteComment,
);

commentRouter.put(
  "/:id",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  withUploads({ field: "images", target: "images", multiple: true }),
  validateRequest(commentValidationSchema.updateComment),
  commentController.updateComment,
);

export default commentRouter;
