/**
 * Bridging the API's response contract and the shape the screens read.
 *
 * The API answers with honest statuses: a success body is `{ data, meta? }`
 * and an error body is `{ error: { message, code?, details? } }`. Every screen
 * in this app was written against the older shape, `{ success, data, meta,
 * message, errorSources }`, where the body itself said whether the request
 * worked. Rewriting each caller would be a large, risky change for no visible
 * gain, so responses are translated back to that shape in one place: the axios
 * interceptor for HTTP requests, and `legacyBody` for the `fetch` calls that
 * read the API directly.
 *
 * The status code is what decides success, never the body: a 200 with an
 * `error` in it would be a contradiction, and a 4xx body is a failure whatever
 * it contains. `message` is kept on failures (the screens show it) and left
 * off successes, whose copy the screens own.
 */

export type {
  IErrorSource,
  IErrorSource as TErrorSource,
} from "@techtipshub/shared";
import type { IErrorSource } from "@techtipshub/shared";

export interface TLegacyBody<TData = unknown> {
  success: boolean;
  data?: TData;
  meta?: Record<string, unknown>;
  message?: string;
  errorSources?: IErrorSource[];
  /**
   * The HTTP status the answer arrived with. Kept because a few screens act on
   * the difference between "your session ended" (401) and a transient failure;
   * everything else only needs `success`.
   */
  statusCode?: number;
}

type TApiBody = {
  data?: unknown;
  meta?: unknown;
  error?: { message?: unknown; code?: unknown; details?: unknown };
};

/**
 * Translate one API body into the shape the screens read.
 *
 * `TData` is the type of the API's own `data` for that route, and is only a
 * claim about the body - nothing here inspects it. A caller that declares it
 * gets typed fields back instead of `unknown`.
 *
 * `ok` is the HTTP status decision, not a guess from the body. `fallback` is
 * what to say when a failure carries no usable message. `status` is recorded on
 * the result for the screens that distinguish a lost session from a blip.
 */
export const legacyBody = <TData = unknown>(
  body: unknown,
  ok: boolean,
  fallback = "Something went wrong.",
  status?: number,
): TLegacyBody<TData> => {
  if (!ok) {
    const error = (body as TApiBody | undefined)?.error;
    const message =
      typeof error?.message === "string" && error.message
        ? error.message
        : fallback;

    return {
      success: false,
      message,
      errorSources: Array.isArray(error?.details)
        ? (error.details as IErrorSource[])
        : undefined,
      ...(status === undefined ? {} : { statusCode: status }),
    } as TLegacyBody<TData>;
  }

  // A success body may be anything the route sent (an object, a list, a bare
  // value under `data`), so `data` is passed through untouched and `meta` is
  // kept flat where the API put it.
  const payload = (body ?? {}) as TApiBody;
  const meta =
    payload.meta && typeof payload.meta === "object"
      ? (payload.meta as Record<string, unknown>)
      : undefined;

  return {
    success: true,
    data: payload.data as TData | undefined,
    ...(meta ? { meta } : {}),
    ...(status === undefined ? {} : { statusCode: status }),
  };
};

/** Whether a body looks like one of the API's own answers. */
const isApiBody = (body: unknown): body is TApiBody => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;

  const record = body as Record<string, unknown>;
  return "data" in record || "error" in record;
};

/**
 * The same translation for a `Response`, for the readers that use `fetch`.
 *
 * A body that is not the API's own (an HTML error page from a proxy) is passed
 * through as-is, so a caller's own fallback still applies.
 */
export const legacyResponse = async <TData = unknown>(
  res: Response,
  fallback?: string,
): Promise<TLegacyBody<TData> | undefined> => {
  const body = await res.json().catch(() => undefined);

  if (!isApiBody(body)) return body as TLegacyBody<TData> | undefined;

  return legacyBody<TData>(body, res.ok, fallback, res.status);
};
