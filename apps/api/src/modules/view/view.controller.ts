import { createHash } from "crypto";
import httpStatus from "http-status";
import type { Context } from "hono";
import { AppError } from "../../errors";
import type { TAppBindings } from "../../interface/bindings";
import sendResponse from "../../utils/sendResponse";
import { recordView } from "./view.service";

/**
 * Derive a pseudonymous key for a guest reader.
 *
 * The client sends a random id kept in a cookie (`visitorId`). Combined with a
 * salted hash of the IP address and user agent it is stable for one reader on
 * one device and changes when any of those change, which is the right scope
 * for "unique views". Only the SHA-256 digest is stored, never the IP itself.
 */
const guestVisitorKey = (
  c: Context<TAppBindings>,
  body: unknown,
): string | undefined => {
  const payload = body as { visitorId?: unknown } | undefined;
  const visitorId =
    typeof payload?.visitorId === "string"
      ? payload.visitorId.slice(0, 64)
      : "";
  if (!visitorId) return undefined;

  // The edge proxy in front of the app is the first entry of the forwarded
  // chain; a direct connection has none and falls back to the socket address.
  const forwarded = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || clientAddress(c) || "unknown";
  const userAgent = c.req.header("user-agent") || "unknown";
  const salt = process.env.JWT_ACCESS_TOKEN_SECRET || "techtipshub";

  return createHash("sha256")
    .update(`${visitorId}|${ip}|${userAgent}|${salt}`)
    .digest("hex");
};

/**
 * The connecting address when the request did not come through a proxy.
 *
 * Hono has no cross-runtime equivalent of Express's `req.socket`, so this
 * reads the Node adapter's raw request when it is there. `unknown` is a fine
 * answer for a hash input, so nothing depends on it being present.
 */
const clientAddress = (c: Context<TAppBindings>): string | undefined => {
  const nodeContext = c as unknown as {
    env?: { incoming?: { socket?: { remoteAddress?: string } } };
    req: { raw?: { socket?: { remoteAddress?: string } } };
  };

  return (
    nodeContext.env?.incoming?.socket?.remoteAddress ??
    nodeContext.req?.raw?.socket?.remoteAddress
  );
};

const recordBlogView = async (c: Context<TAppBindings>) => {
  const slug = c.req.param("slug")!;
  const user = c.get("user");
  const body = c.get("validatedBody");

  const totalViews = await recordView(slug, {
    user,
    visitorKey: user ? undefined : guestVisitorKey(c, body),
  });

  if (totalViews === null) {
    throw new AppError(httpStatus.NOT_FOUND, "Blog not found");
  }

  return sendResponse(c, httpStatus.OK, { data: { totalViews } });
};

export const viewController = {
  recordBlogView,
};
