import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth, validate } from "../../middlewares";
import { categoryController } from "./category.controller";
import { categoryValidationSchema } from "./category.validation";

const categoryRouter = new Hono<TAppBindings>();

// Public reads. Creating, editing and deleting a category is the admin's, under
// "/admin/categories", with one exception: a signed-in member writing an
// article makes the category they need on the spot, so the composer never has
// to send them to an admin and back.
categoryRouter.get("/", categoryController.getAll);

categoryRouter.post(
  "/",
  auth(USER_ROLE.USER),
  validate({ json: categoryValidationSchema.createByAuthor }),
  categoryController.createByAuthor,
);

categoryRouter.get("/:id", categoryController.getSingleCategory);

export default categoryRouter;
