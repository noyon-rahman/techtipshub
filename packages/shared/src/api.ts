import type { TUserRole } from "./enums";

/**
 * The response envelope every API route answers with.
 *
 * Success is `{ data, meta? }` and failure is `{ error: { message, code?,
 * details? } }`. Declaring it here lets the site type a request once instead of
 * re-describing the wrapper at each call site.
 */
export interface IResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  /** The API names this `totalPages`, never `totalPage`. */
  totalPages?: number;
  [key: string]: unknown;
}

/**
 * One field-level problem, as the API's error handlers emit it. `path` is the
 * request field the problem belongs to, so a form can show it inline.
 */
export interface IErrorSource {
  path: string | number;
  message: string;
}

export interface IResponseError {
  message: string;
  /** Stable machine-readable name, e.g. `VALIDATION_ERROR`. */
  code?: string;
  details?: IErrorSource[];
}

export interface ISuccessEnvelope<T> {
  data: T;
  meta?: IResponseMeta;
}

export interface IErrorEnvelope {
  error: IResponseError;
}

export type TApiResponse<T> = ISuccessEnvelope<T> | IErrorEnvelope;

/**
 * Whether a parsed body carries the failure envelope. Narrowing on the key is
 * enough: the API never puts `error` on a success body.
 */
export function isErrorEnvelope<T>(
  body: TApiResponse<T>,
): body is IErrorEnvelope {
  return "error" in body;
}

/**
 * The decoded session token. `iat` and `exp` are the JWT's own claims, which
 * the site reads to renew a session before it expires.
 */
export interface ILoggedInUser {
  _id: string;
  email: string;
  name: string;
  username: string;
  profilePicture: string;
  role: TUserRole;
  iat: number;
  exp: number;
}
