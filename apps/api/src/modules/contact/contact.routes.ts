import { Hono } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import { validateRequest } from "../../middlewares";
import { contactController } from "./contact.controller";
import { contactValidationSchema } from "./contact.validation";

const contactRoutes = new Hono<TAppBindings>();

// Public contact form. Inbox handling lives under "/admin/messages".
contactRoutes.post(
  "/",
  validateRequest(contactValidationSchema.create),
  contactController.create,
);

export default contactRoutes;
