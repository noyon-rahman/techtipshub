import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import app from "./app/app";
import config from "./config";
import connectToDatabase from "./db";

/**
 * What a Vercel Function runs: the platform wraps the default export and
 * calls it per request, so nothing here opens a port. `main()` still starts
 * the database connection at module load, which is what the first request
 * wants, and it is the only place the validated config is read for a hosted
 * deploy. Without this export the platform has nothing to serve and answers
 * FUNCTION_INVOCATION_FAILED. The long-running `serve` path below is for a
 * real server (local, container, VM) and is skipped there.
 */
export default app;

let server: ServerType | undefined;

const main = async () => {
  await connectToDatabase();

  server = serve({ fetch: app.fetch, port: config.PORT }, ({ port }) => {
    // eslint-disable-next-line no-console
    console.log(`🚀 Server is listening on port ${port}`);
  });
};

main();

// `VERCEL` is set by the platform, at build and at runtime. Opening a port
// there would fight the platform's own request handling.
if (!process.env.VERCEL) {
  process.on("unhandledRejection", (reason) => {
    // eslint-disable-next-line no-console
    console.log(`❌ unhandledRejection is detected, shutting down the server...`);
    // eslint-disable-next-line no-console
    console.error(reason);
    server?.close(() => {
      process.exit(1);
    });
    process.exit(1);
  });

  process.on("uncaughtException", (error) => {
    // eslint-disable-next-line no-console
    console.log(`❌ uncaughtException is detected, shutting down the server...`);
    // eslint-disable-next-line no-console
    console.error(error);
    process.exit(1);
  });
}
