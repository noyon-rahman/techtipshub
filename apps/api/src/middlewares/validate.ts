import { getCookie } from "hono/cookie";
import type { MiddlewareHandler, ValidationTargets } from "hono";
import type { ZodType } from "zod";
import type { TAppBindings } from "../interface/bindings";

/**
 * The parts of a request a route can ask to have validated.
 *
 * Every one is a target Hono itself reads, so a route names exactly what it
 * uses. `json` also covers a multipart body: `withUploads` has already read
 * that and assembled the object, so it is what the schema judges.
 */
export type TTarget = keyof ValidationTargets;

type TSchemaMap = Partial<Record<TTarget, ZodType>>;
type TContext = Parameters<MiddlewareHandler<TAppBindings>>[0];

/**
 * Validate one or more parts of a request before its handler runs.
 *
 * Each key is one of Hono's own validation targets, so a route names what it
 * actually reads: `validate({ json: bodySchema })`,
 * `validate({ query: listSchema, param: idSchema })`, or
 * `validate({ cookie: sessionSchema })`. Out of the box that covers `json`,
 * `form`, `query`, `param`, `cookie` and `header`.
 *
 * The parsed output (defaults applied, unknown keys stripped) is stored on the
 * context as `validatedBody` or `validatedCookies`, which is what a handler in
 * this app reads.
 *
 * A failure is thrown as the Zod error rather than answered here, so the app's
 * single error handler answers `{ error: { message, code, details } }` like
 * every other failure and a form still gets per-field `details`.
 *
 * Bodies are the one departure from `zValidator`. A `json` or `form` schema
 * judges the object `withUploads` assembled when a multipart request has been
 * uploaded, and an empty object when the request carries no parsable body.
 * `zValidator` reads the raw request instead and skips it on a content type it
 * does not recognise, which would make every valid upload look empty.
 */
const validate = (schemas: TSchemaMap): MiddlewareHandler<TAppBindings> => {
  const steps = Object.entries(schemas).map(([target, schema]) =>
    buildStep(target as TTarget, schema as ZodType),
  );

  return async (c, next) => {
    for (const step of steps) await step(c);

    await next();
  };
};

/**
 * Parse one part, throwing its Zod error so the error handler formats it.
 *
 * The values are read the way Hono's own `validator` reads them, but its
 * middleware is not used: it calls `next()` itself, and these steps run in
 * sequence under one wrapper that calls it once at the end.
 */
const buildStep =
  (target: TTarget, schema: ZodType) =>
  async (c: TContext) => {
    const parsed = await schema.safeParseAsync(await readPart(target, c));

    if (!parsed.success) throw parsed.error;

    if (target === "cookie") c.set("validatedCookies", parsed.data);
    else c.set("validatedBody", parsed.data);
  };

const readPart = async (target: TTarget, c: TContext) => {
  switch (target) {
    case "json":
    case "form":
      return readBody(c);
    case "query":
      // A repeated name arrives as a list; a single one as the string.
      return Object.fromEntries(
        Object.entries(c.req.queries()).map(([key, values]) =>
          values.length === 1 ? [key, values[0]] : [key, values],
        ),
      );
    case "param":
      return c.req.param();
    case "header":
      return c.req.header();
    case "cookie":
      return getCookie(c);
    default:
      return {};
  }
};

const readBody = async (c: TContext) => {
  const uploaded = c.get("uploadedBody");
  if (uploaded) return uploaded;

  if (!(c.req.header("content-type") ?? "").includes("application/json")) {
    return {};
  }

  return (await c.req.json().catch(() => ({}))) as unknown;
};

export default validate;
