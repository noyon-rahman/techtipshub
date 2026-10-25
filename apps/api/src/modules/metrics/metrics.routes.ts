import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth } from "../../middlewares";
import { metricsController } from "./metrics.controller";

const metricsRouter = new Hono<TAppBindings>();

metricsRouter.get("/dashboard", auth(USER_ROLE.ADMIN), metricsController.dashboard);

export default metricsRouter;
