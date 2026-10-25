import type { Context, Env } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

/**
 * Pagination block that rides beside a list answer.
 *
 * It is the only piece of a response that is not the payload itself, so it
 * stays at the top level (`{ data, meta }`) instead of being copied into
 * every `data`.
 */
export type TPaginationMeta = {
  limit?: number;
  total?: number;
  page?: number;
  totalPages?: number;
};

type TSuccess<T> = {
  data: T;
  meta?: TPaginationMeta;
};

/**
 * Send a successful answer: `{ data, meta? }`.
 *
 * The HTTP status is the only place the outcome is recorded. There is no
 * `success` flag and no `statusCode` in the body, so a caller reads the status
 * line and nothing else to tell 200 from 404.
 */
const sendResponse = <
  T,
  E extends Env,
  P extends string = string,
  S extends ContentfulStatusCode = ContentfulStatusCode,
>(
  c: Context<E, P>,
  status: S,
  body: TSuccess<T>,
) => c.json(body, status);

export default sendResponse;
