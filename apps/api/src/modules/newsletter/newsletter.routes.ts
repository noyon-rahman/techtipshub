import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth, validate } from "../../middlewares";
import { mailLimit } from "../../middlewares/rateLimit";
import { newsletterController } from "./newsletter.controller";
import { newsletterValidationSchema } from "./newsletter.validation";

const newsletterRoutes = new Hono<TAppBindings>();

/**
 * Public signup. Limited like the other routes that send mail on our behalf,
 * because every accepted signup sends the welcome mail.
 */
newsletterRoutes.post(
  "/",
  mailLimit,
  validate({ json: newsletterValidationSchema.subscribe }),
  newsletterController.subscribe,
);

// The token a campaign was opened with; checked by signature in the page.
newsletterRoutes.get(
  "/unsubscribe",
  validate({ query: newsletterValidationSchema.unsubscribeQuery }),
  newsletterController.readUnsubscribeLink,
);

// Removing the address the link names, verified the same way.
newsletterRoutes.post(
  "/unsubscribe",
  validate({ json: newsletterValidationSchema.unsubscribeBody }),
  newsletterController.unsubscribe,
);

// Machine callers: Resend's webhook. Not a browser.
newsletterRoutes.post("/webhook/resend", newsletterController.resendEvents);

/**
 * The profile switch, both readings of it. Membership is the account's own
 * address on the same list the public form writes to, so the two sit together.
 */
newsletterRoutes.get(
  "/membership",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  newsletterController.getMembership,
);

newsletterRoutes.put(
  "/membership",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validate({ json: newsletterValidationSchema.membership }),
  newsletterController.setMembership,
);

export default newsletterRoutes;
