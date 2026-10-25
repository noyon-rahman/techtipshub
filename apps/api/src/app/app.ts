import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import mainRoutes from "../routes";
import type { TAppBindings } from "../interface/bindings";
import errorHandler, { notFound } from "./errorHandler";

const app = new Hono<TAppBindings>();

app.use("*", logger());
app.use("*", secureHeaders());
app.use(
  "*",
  cors({
    origin: [
      "http://localhost:3000",
      "http://192.168.0.116:3000",
      "https://techtipshub.vercel.app",
      "https://techtipshub-password-reset.vercel.app",
    ],
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

app.get("/", (c) => c.json({ data: { message: "Hello World!" } }));
app.get("/health", (c) => c.text("OK✅"));

app.route("/api/v1", mainRoutes);

app.notFound(notFound);
app.onError(errorHandler);

export default app;
