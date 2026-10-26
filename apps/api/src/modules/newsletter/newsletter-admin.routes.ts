import { Hono } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import { validate } from "../../middlewares";
import { newsletterAdminController } from "./newsletter.controller";
import { newsletterValidationSchema } from "./newsletter.validation";

/**
 * These sit under `/admin`, which `admin.routes.ts` already guards with
 * `auth(USER_ROLE.ADMIN)` for the whole tree, so no guard is repeated here.
 */
const adminNewsletterSubscriberRouter = new Hono<TAppBindings>();

// Literal paths must stay above "/:id".
adminNewsletterSubscriberRouter.get(
  "/",
  newsletterAdminController.getAllSubscribers,
);
adminNewsletterSubscriberRouter.get(
  "/export",
  newsletterAdminController.exportSubscribers,
);
adminNewsletterSubscriberRouter.post(
  "/",
  validate({ json: newsletterValidationSchema.createSubscriber }),
  newsletterAdminController.createSubscriber,
);
adminNewsletterSubscriberRouter.post(
  "/unsubscribe",
  validate({ json: newsletterValidationSchema.unsubscribeBody }),
  newsletterAdminController.unsubscribeSubscriber,
);
adminNewsletterSubscriberRouter.get(
  "/:id",
  newsletterAdminController.getSubscriber,
);

const adminNewsletterCampaignRouter = new Hono<TAppBindings>();

adminNewsletterCampaignRouter.get("/", newsletterAdminController.listCampaigns);

// What the composer opens with: the heading of the month, and every article
// published since the last issue started.
adminNewsletterCampaignRouter.get(
  "/suggestion",
  newsletterAdminController.campaignSuggestion,
);

adminNewsletterCampaignRouter.post(
  "/",
  validate({ json: newsletterValidationSchema.createCampaign }),
  newsletterAdminController.createCampaign,
);

adminNewsletterCampaignRouter.get("/:id", newsletterAdminController.getCampaign);
adminNewsletterCampaignRouter.put(
  "/:id",
  validate({ json: newsletterValidationSchema.updateCampaign }),
  newsletterAdminController.updateCampaign,
);
adminNewsletterCampaignRouter.delete(
  "/:id",
  newsletterAdminController.deleteCampaign,
);

adminNewsletterCampaignRouter.get(
  "/:id/preview",
  newsletterAdminController.previewCampaign,
);
adminNewsletterCampaignRouter.post(
  "/:id/test",
  newsletterAdminController.testCampaign,
);
adminNewsletterCampaignRouter.post(
  "/:id/start",
  newsletterAdminController.startCampaign,
);
adminNewsletterCampaignRouter.post(
  "/:id/continue",
  newsletterAdminController.continueCampaign,
);
adminNewsletterCampaignRouter.get(
  "/:id/progress",
  newsletterAdminController.campaignProgress,
);

export { adminNewsletterSubscriberRouter, adminNewsletterCampaignRouter };
