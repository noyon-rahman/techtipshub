import httpStatus from "http-status";
import type { Context } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import type { TRouteParams } from "../../interface/params";
import sendResponse from "../../utils/sendResponse";
import { contactService } from "./contact.service";
import type { TContactStatus } from "./contact.model";

/**
 * Resolve the visitor's address for rate limiting.
 *
 * Behind a proxy (Vercel, Render, nginx) the connection comes from the proxy,
 * so every visitor would share one bucket. Prefer the left-most
 * `X-Forwarded-For` entry, which is the originating client. Global proxy
 * trust is left untouched so other endpoints keep their behaviour.
 */
const resolveClientKey = (c: Context<TAppBindings>) => {
  const forwarded = c.req.header("x-forwarded-for");

  if (forwarded?.trim()) {
    // client, proxy1, proxy2 -> client
    return forwarded.split(",")[0].trim();
  }

  return "unknown";
};

const create = async (c: Context<TAppBindings>) => {
  const result = await contactService.create(
    c.get("validatedBody"),
    resolveClientKey(c),
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

const getAll = async (c: Context<TAppBindings>) => {
  const { result, meta, counts } = await contactService.getAll(c.req.query());

  return sendResponse(c, httpStatus.OK, {
    meta,
    data: { result, meta, counts },
  });
};

const getSingle = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;

  const result = await contactService.getSingle(id);

  return sendResponse(c, httpStatus.OK, { data: result });
};

const updateStatus = async (c: Context<TAppBindings, string>) => {
  const { id } = c.req.param() as TRouteParams;
  const { status } = c.get("validatedBody") as { status: TContactStatus };

  const result = await contactService.updateStatus(
    id,
    status,
    c.get("user").email,
  );

  return sendResponse(c, httpStatus.OK, { data: result });
};

export const contactController = { create, getAll, getSingle, updateStatus };
