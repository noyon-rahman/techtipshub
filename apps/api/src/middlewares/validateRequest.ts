import type { MiddlewareHandler } from "hono";
import type { ZodType } from "zod";
import type { TAppBindings } from "../interface/bindings";

/**
 * Validate a request body (and the cookies, where a route reads them) before
 * its handler runs.
 *
 * The Zod error is thrown rather than answered here: the single error handler
 * turns it into the `{ error: { message, code, details } }` body that every
 * other failure uses.
 *
 * The parsed values are handed back, so a caller gets the schema's output
 * (defaults applied, unknown keys stripped) instead of the raw body.
 *
 * A route with no `Content-Type` has nothing to read, and a route whose
 * schema only looks at cookies must not fail on a body that is not there:
 * both are read as an empty object, which is what the schema then judges.
 *
 * An uploaded request is the exception: `withUploads` has already consumed
 * the form and assembled the object, so that object is what gets validated.
 */
const validateRequest = (schema: ZodType): MiddlewareHandler<TAppBindings> => {
  return async (c, next) => {
    const body = c.get("uploadedBody") ?? (await readBody(c));

    const parsed = (await schema.parseAsync({
      body,
      cookies: c.req.header("cookie") ? readCookies(c) : {},
    })) as { body?: unknown; cookies?: unknown };

    c.set("validatedBody", parsed.body);
    c.set("validatedCookies", parsed.cookies);

    await next();
  };
};

/**
 * JSON, or a form encoded as multipart or urlencoded.
 *
 * Multipart only arrives as files plus a `data` field here: the upload
 * middleware replaces that string with the parsed object before validation
 * runs, so a plain request never reaches this reading files.
 */
const readBody = async (c: Parameters<MiddlewareHandler<TAppBindings>>[0]) => {
  const contentType = c.req.header("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return (await c.req.json().catch(() => ({}))) as unknown;
  }

  if (
    contentType.includes("multipart/form-data") ||
    contentType.includes("application/x-www-form-urlencoded")
  ) {
    return (await c.req.parseBody().catch(() => ({}))) as unknown;
  }

  return {};
};

/**
 * The request's cookies as one object.
 *
 * A repeated name keeps its last value, and a value with no `=` is kept as an
 * empty string rather than dropped.
 */
const readCookies = (c: Parameters<MiddlewareHandler<TAppBindings>>[0]) => {
  const jar: Record<string, string> = {};

  for (const pair of (c.req.header("cookie") ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;

    const name = pair.slice(0, separator).trim();
    if (!name) continue;

    const value = pair.slice(separator + 1).trim();
    jar[name] = value.startsWith('"') && value.endsWith('"')
      ? value.slice(1, -1)
      : value;
  }

  return jar;
};

export default validateRequest;
