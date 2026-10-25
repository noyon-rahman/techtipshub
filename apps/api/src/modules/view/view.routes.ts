import { Hono } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import { optionalAuth } from "../../middlewares";
import { viewController } from "./view.controller";

const viewRouter = new Hono<TAppBindings>();

// Record a view for a blog and return its fresh total. Open to guests as well
// as signed-in readers: optionalAuth only tells us who is asking.
viewRouter.post("/:slug", optionalAuth, viewController.recordBlogView);

export default viewRouter;
