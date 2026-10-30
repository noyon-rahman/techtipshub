import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth, validate } from "../../middlewares";
import { uploadController } from "./upload.controller";
import { uploadValidationSchema } from "./upload.validation";

const uploadRouter = new Hono<TAppBindings>();

// The browser uploads straight to Cloudinary with this; the API only signs,
// so a file never passes through the function body. The composer no longer
// calls it, and it stays for any client that still does.
uploadRouter.post(
  "/signature",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validate({ json: uploadValidationSchema.signature }),
  uploadController.sign,
);

// The composer sends the cover here as soon as it is picked, so the writer
// gets the stored URL back before the article is submitted.
uploadRouter.post(
  "/cover",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  uploadController.uploadCover,
);

// The id comes from the client, so the service only deletes inside this site's
// folders; without that check any member could delete any asset on the account.
uploadRouter.delete(
  "/asset",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validate({ json: uploadValidationSchema.deleteAsset }),
  uploadController.deleteAsset,
);

export default uploadRouter;
