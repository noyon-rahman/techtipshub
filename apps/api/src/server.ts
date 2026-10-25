import app from "./app/app";

/**
 * What Vercel imports: one `fetch` handler, called per request.
 *
 * No `@hono/node-server` here. That package opens a listening socket, which is
 * not something the platform lets a function do, and it is the only reason this
 * file needed a dependency of its own. A function is entered through its
 * default export, not through a port, so importing the server here only made
 * the bundle bigger and gave it a package to fail on. The long-running server
 * lives in `main.ts` and is what `dev` and `start` run.
 */
export default app;
