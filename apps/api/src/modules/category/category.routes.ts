import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth, validate } from "../../middlewares";
import { categoryController } from "./category.controller";
import { categoryValidationSchema } from "./category.validation";

const categoryRouter = new Hono<TAppBindings>();

// Public reads. Creating, editing and deleting a category is the admin's, under
// "/admin/categories". A member can ask for one that does not exist yet, and
// read back the asks that went live.
categoryRouter.get("/", categoryController.getAll);

// Literal paths stay above "/:id", or "requests" is read as an id.
categoryRouter.post(
  "/requests",
  auth(USER_ROLE.USER),
  validate({ json: categoryValidationSchema.createRequest }),
  categoryController.requestCategory,
);

categoryRouter.get(
  "/requests/mine",
  auth(USER_ROLE.USER),
  categoryController.getMyRequests,
);

categoryRouter.get("/:id", categoryController.getSingleCategory);

export default categoryRouter;
