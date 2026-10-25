import type { Hono } from "hono";
import app from "./app/app";
import connectToDatabase from "./db";
import type { TAppBindings } from "./interface/bindings";

/**
 * What Vercel imports: one `fetch` handler, called per request.
 *
 * The platform finds this file because it imports `hono` directly, then bundles
 * it from source. Nothing here opens a port; the long-running server lives in
 * `main.ts` and is what `dev` and `start` run.
 *
 * The connection starts as the module loads, so the first request arrives with
 * it already in flight. `db/index.ts` explains the buffering that covers the
 * gap, and why a failed connect must not take the process down here.
 */
const server: Hono<TAppBindings> = app;

connectToDatabase();

export default server;
