import { Hono } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import { categoryController } from "./category.controller";

const categoryRouter = new Hono<TAppBindings>();

// Public reads only. Writes live under "/admin/categories".
categoryRouter.get("/", categoryController.getAll);

categoryRouter.get("/:id", categoryController.getSingleCategory);

export default categoryRouter;
