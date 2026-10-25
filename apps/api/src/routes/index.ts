import { Hono } from "hono";
import authRoutes from "../modules/auth/auth.routes";
import adminRoutes from "../modules/admin/admin.routes";
import categoryRoutes from "../modules/category/category.routes";
import commentRoutes from "../modules/comment/comment.routes";
import contactRoutes from "../modules/contact/contact.routes";
import metricsRoutes from "../modules/metrics/metrics.routes";
import blogRoutes from "../modules/blog/blog.routes";
import userRoutes from "../modules/user/user.routes";
import viewRoutes from "../modules/view/view.routes";
import type { TAppBindings } from "../interface/bindings";

const router = new Hono<TAppBindings>();

const moduleRoutes = [
  { path: "/auth", routes: authRoutes },
  { path: "/users", routes: userRoutes },
  { path: "/admin", routes: adminRoutes },
  { path: "/categories", routes: categoryRoutes },
  { path: "/blogs", routes: blogRoutes },
  { path: "/comments", routes: commentRoutes },
  { path: "/metrics", routes: metricsRoutes },
  { path: "/contact", routes: contactRoutes },
  // Unique-reader view counting for guests and signed-in readers alike.
  { path: "/views", routes: viewRoutes },
];

for (const { path, routes } of moduleRoutes) {
  router.route(path, routes);
}

export default router;
