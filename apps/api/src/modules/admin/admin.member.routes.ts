import { Hono } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import { validate, withUploads } from "../../middlewares";
import { commentController } from "../comment/comment.controller";
import { categoryValidationSchema } from "../category/category.validation";
import { contactController } from "../contact/contact.controller";
import { contactValidationSchema } from "../contact/contact.validation";
import { userController } from "../user/user.controller";
import { userValidationSchema } from "../user/user.validation";
import { adminController } from "./admin.controller";
import { adminCommentController } from "./admin.comment.controller";

const adminUserRouter = new Hono<TAppBindings>();

adminUserRouter.get("/", userController.getAllUsers);

// Literal path before "/:id" routes.
adminUserRouter.get("/trash", userController.getDeletedUsers);

// One member for the detail screen. The list endpoint cannot stand in: it is
// capped at 100 rows and only matches names, handles and emails.
adminUserRouter.get("/:id", adminController.getMember);

adminUserRouter.patch("/:id/restore", userController.restoreUser);
adminUserRouter.patch("/:id/block", userController.blockUser);
adminUserRouter.patch("/:id/unblock", userController.unBlockUser);
adminUserRouter.patch("/:id/make-admin", userController.makeAdmin);
adminUserRouter.post(
  "/:id/resend-verification",
  userController.resendVerificationEmail,
);
adminUserRouter.patch(
  "/:id",
  withUploads({
    field: "image",
    target: "profilePicture",
    resourceType: "auto",
  }),
  validate({ json: userValidationSchema.updateProfileByAdmin }),
  userController.updateProfileByAdmin,
);
adminUserRouter.delete("/:id", userController.deleteUserAccount);
// Only a trashed account, the same rule the article endpoint keeps.
adminUserRouter.delete(
  "/:id/permanent",
  userController.deleteUserAccountPermanently,
);

// Literal above "/:id". A list of ids in the body: a bulk move to the trash,
// then erasing the ones already there. The saved user endpoints carry no path
// parameter, so they fit the one declaration route.
adminUserRouter.post(
  "/bulk-delete",
  validate({ json: categoryValidationSchema.bulkDelete }),
  userController.deleteUsersInBulk,
);
adminUserRouter.post(
  "/trash/permanent",
  validate({ json: categoryValidationSchema.bulkDelete }),
  userController.deleteUsersPermanently,
);

const adminCommentRouter = new Hono<TAppBindings>();

// Literal paths must stay above "/:id".
adminCommentRouter.get("/", commentController.getAll);
adminCommentRouter.get("/latest", commentController.getLatest);
adminCommentRouter.get("/counts", commentController.getCounts);

adminCommentRouter.delete("/:id", adminCommentController.deleteComment);

// Trash: a removed comment waits here before it can be erased for good.
adminCommentRouter.get("/trash", adminCommentController.getDeletedComments);

adminCommentRouter.post(
  "/trash/permanent",
  validate({ json: categoryValidationSchema.bulkDelete }),
  adminCommentController.deleteCommentsPermanently,
);

const adminMessageRouter = new Hono<TAppBindings>();

adminMessageRouter.get("/", contactController.getAll);
adminMessageRouter.get("/:id", contactController.getSingle);
adminMessageRouter.patch(
  "/:id/status",
  validate({ json: contactValidationSchema.updateStatus }),
  contactController.updateStatus,
);

export { adminUserRouter, adminCommentRouter, adminMessageRouter };
