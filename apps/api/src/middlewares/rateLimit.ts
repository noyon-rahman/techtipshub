import { rateLimiter } from "hono-rate-limiter";
import httpStatus from "http-status";
import type { Context } from "hono";
import config from "../config";
import { AppError } from "../errors";
import type { TAppBindings } from "../interface/bindings";

/**
 * What counts as one client.
 *
 * Behind a proxy - Vercel, or any load balancer - every request arrives from
 * the proxy's own address, so limiting on the socket would put the whole site
 * in one bucket and one visitor could lock everyone out. The forwarded header
 * is what the proxy adds; the leftmost entry is the original client.
 *
 * Reading a client-supplied header is a trust decision, and it is only sound
 * because in production nothing reaches this process except through the proxy
 * that overwrites it. Set `TRUST_PROXY=false` in an environment where the app
 * is reachable directly.
 */
const clientAddress = (c: Context<TAppBindings>) => {
  if (config.TRUST_PROXY) {
    const forwarded = c.req.header("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();

    const realIp = c.req.header("x-real-ip");
    if (realIp) return realIp.trim();
  }

  return c.req.header("cf-connecting-ip") ?? "unknown";
};

/**
 * A limit on how often a route may be called from one address.
 *
 * The counters live in this process's memory. That is enough for one instance
 * and resets on deploy; if the API is ever run on more than one, this needs a
 * shared store or each instance would grant its own allowance.
 *
 * The refusal is shaped like every other error this API sends, and names the
 * wait, because "too many requests" with no idea when to retry is how a real
 * member gets locked out of their own account by a mistyped password.
 */
const rateLimit = (options: {
  max?: number;
  windowMinutes?: number;
  message: string;
}) => {
  const windowMs =
    (options.windowMinutes ?? config.AUTH_RATE_LIMIT_WINDOW_MINUTES) *
    60 *
    1000;

  return rateLimiter<TAppBindings>({
    windowMs,
    limit: options.max ?? config.AUTH_RATE_LIMIT_MAX,
    standardHeaders: "draft-7",
    keyGenerator: clientAddress,
    // The generic handler cannot know this API's response shape, so the
    // refusal is thrown instead and comes out of the one error handler.
    handler: (c) => {
      c.header("Retry-After", String(Math.ceil(windowMs / 1000)));

      throw new AppError(httpStatus.TOO_MANY_REQUESTS, options.message);
    },
  });
};

/**
 * Password guessing and reset-link guessing.
 *
 * Generous enough that a person who has forgotten which password they used is
 * never blocked in practice, tight enough that a script makes no progress.
 */
const authAttemptLimit = rateLimit({
  message:
    "Too many attempts from this address. Wait a few minutes, then try again.",
});

/**
 * The routes that mint a session or send mail: sign-in, signup, Google start,
 * password reset requests. Everything else on `/auth` is authenticated and is
 * left alone, so a signed-in member's normal use is never throttled.
 */
const mailLimit = rateLimit({
  max: 5,
  windowMinutes: 60,
  message:
    "Too many requests from this address. Wait a while before trying again.",
});

export { authAttemptLimit, mailLimit };
