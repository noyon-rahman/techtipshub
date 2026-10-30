/**
 * Admin API. Everything here is mounted at `/api/v1/admin` and sits behind
 * `auth(USER_ROLE.ADMIN)`; the module routers keep only public/member routes.
 *
 * Query parameters are whitelisted per endpoint. An unknown value for an
 * enum-like one (`role`, `status`, `within`, blog `status`, `sort`) answers
 * 400; unknown keys are ignored. Every paged list returns
 * `meta: { page, limit, total, totalPages }`.
 *
 * Dashboard and audit
 *   GET    /admin/overview
 *   GET    /admin/search?q=
 *   GET    /admin/activity?days=
 *   GET    /admin/logs?limit=
 *   GET    /admin/metrics/dashboard
 *
 * Members
 *   GET    /admin/users?page=&limit=&sort=&role=&status=&searchTerm=
 *   GET    /admin/users/trash?page=&limit=&searchTerm=
 *   GET    /admin/users/:id
 *   PATCH  /admin/users/:id/restore
 *   PATCH  /admin/users/:id/block
 *   PATCH  /admin/users/:id/unblock
 *   PATCH  /admin/users/:id/make-admin
 *   DELETE /admin/users/:id
 *
 * Blogs
 *   GET    /admin/blogs?page=&limit=&searchTerm=&category=&author=&sort=&status=
 *   GET    /admin/blogs/trash?page=&limit=&searchTerm=
 *   PATCH  /admin/blogs/:id/restore
 *   PUT    /admin/blogs/:id          (multipart: `image` + `data`)
 *   DELETE /admin/blogs/:id
 *
 * Categories
 *   GET    /admin/categories?searchTerm=&page=&limit=
 *   POST   /admin/categories
 *   GET    /admin/categories/requests?status=&searchTerm=&page=&limit=
 *   PATCH  /admin/categories/requests/:id     (body: `status`, optional `declineReason`)
 *   PATCH  /admin/categories/:id
 *   DELETE /admin/categories/:id
 *
 * Comments
 *   GET    /admin/comments?page=&limit=&sort=&searchTerm=&within=&post=&user=
 *   GET    /admin/comments/latest
 *   GET    /admin/comments/counts
 *   DELETE /admin/comments/:id
 *
 * Messages (contact form)
 *   GET    /admin/messages?page=&limit=&sort=&status=&searchTerm=
 *   GET    /admin/messages/:id
 *   PATCH  /admin/messages/:id/status
 *
 * Newsletter
 *   GET    /admin/newsletter/subscribers?page=&limit=&sort=&status=&source=&searchTerm=
 *   GET    /admin/newsletter/subscribers/export        (CSV download)
 *   POST   /admin/newsletter/subscribers               (add, optional welcome mail)
 *   POST   /admin/newsletter/subscribers/unsubscribe   (body: `email`)
 *   GET    /admin/newsletter/subscribers/:id
 *   GET    /admin/newsletter/campaigns?page=&limit=
 *   GET    /admin/newsletter/campaigns/suggestion      (articles since the last issue)
 *   POST   /admin/newsletter/campaigns
 *   GET    /admin/newsletter/campaigns/:id
 *   PUT    /admin/newsletter/campaigns/:id             (drafts only)
 *   DELETE /admin/newsletter/campaigns/:id             (drafts only)
 *   GET    /admin/newsletter/campaigns/:id/preview
 *   POST   /admin/newsletter/campaigns/:id/test
 *   POST   /admin/newsletter/campaigns/:id/start
 *   POST   /admin/newsletter/campaigns/:id/continue    (drain a batch by hand)
 *   GET    /admin/newsletter/campaigns/:id/progress
 *
 * `GET /api/v1/metrics/dashboard` still exists for older callers.
 */
import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth } from "../../middlewares";
import { metricsController } from "../metrics/metrics.controller";
import {
  adminNewsletterCampaignRouter,
  adminNewsletterSubscriberRouter,
} from "../newsletter/newsletter-admin.routes";
import { adminController } from "./admin.controller";
import { adminBlogRouter, adminCategoryRouter } from "./admin.content.routes";
import {
  adminCommentRouter,
  adminMessageRouter,
  adminUserRouter,
} from "./admin.member.routes";

const adminRouter = new Hono<TAppBindings>();

// One guard for the whole tree. A Hono route's middleware only runs for that
// route, so this is registered as a wildcard before anything is mounted;
// otherwise a request would reach a nested handler before being checked.
adminRouter.use("*", auth(USER_ROLE.ADMIN));

adminRouter.get("/overview", adminController.overview);
adminRouter.get("/search", adminController.search);
adminRouter.get("/activity", adminController.activity);
adminRouter.get("/logs", adminController.getLogs);
adminRouter.get("/metrics/dashboard", metricsController.dashboard);

adminRouter.route("/users", adminUserRouter);
adminRouter.route("/blogs", adminBlogRouter);
adminRouter.route("/categories", adminCategoryRouter);
adminRouter.route("/comments", adminCommentRouter);
adminRouter.route("/messages", adminMessageRouter);
adminRouter.route("/newsletter/subscribers", adminNewsletterSubscriberRouter);
adminRouter.route("/newsletter/campaigns", adminNewsletterCampaignRouter);

export default adminRouter;
