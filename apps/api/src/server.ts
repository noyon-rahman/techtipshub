import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import app from "./app/app";
import config from "./config";
import connectToDatabase from "./db";

let server: ServerType | undefined;

const main = async () => {
  // database connection
  await connectToDatabase();

  server = serve(
    { fetch: app.fetch, port: Number(config.port) },
    ({ port }) => {
      // eslint-disable-next-line no-console
      console.log(`🚀 Server is listening on port ${port}`);
    },
  );
};

main();

// handle unhandledRejection
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

// handle uncaughtException
process.on("uncaughtException", (error) => {
  // eslint-disable-next-line no-console
  console.log(`❌ uncaughtException is detected, shutting down the server...`);
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
