import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import connectToDatabase from "../db";
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
    allowHeaders: ["Content-Type", "Authorization", "X-Reset-Token"],
  }),
);

/**
 * Start the shared connection before the route runs; a query that arrives
 * first buffers until it is up. Attempting it per request means an instance
 * whose cold start could not reach Atlas recovers on the next one instead of
 * staying broken until it is recycled.
 */
app.use("*", async (_c, next) => {
  connectToDatabase().catch(() => {
    // The failure is already logged. Routing continues so a query answers
    // through the error handler rather than the request never starting.
  });

  await next();
});

app.get("/", (c) => c.json({ data: { message: "Hello World!" } }));
app.get("/health", (c) => c.text("OK✅"));

app.route("/api/v1", mainRoutes);

app.notFound(notFound);
app.onError(errorHandler);

export default app;
