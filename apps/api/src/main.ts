import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import app from "./app/app";
import config from "./config";
import connectToDatabase from "./db";

/**
 * A server with a port of its own: local development, a container, a VM.
 * Vercel never runs this file; it imports `server.ts`, which exports the app.
 */
let server: ServerType | undefined;

const main = async () => {
  await connectToDatabase();

  server = serve({ fetch: app.fetch, port: config.PORT }, ({ port }) => {
    // eslint-disable-next-line no-console
    console.log(`🚀 Server is listening on port ${port}`);
  });
};

main();

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
