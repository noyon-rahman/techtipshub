import type { ReadonlyURLSearchParams } from "next/navigation";

import type { TAdminMessageFilter } from "@/types/admin.type";

/**
 * The query string of an admin list screen, in one place.
 *
 * Every admin list used to hold its tab, page, page size and search in local
 * state, so a reload, a bookmark or a shared link landed on a fresh screen and
 * a queue tile could not open the tab it was counting.
 *
 * A screen declares only the params it owns (see `TListParamInput`); anything
 * else in the URL is left untouched, so `?message=<id>` on the inbox and a
 * future `?tab=` survive every filter change. Reads never throw: a param that
 * is not valid for its declaration reads as the default, so `?page=abc` or
 * `?status=../../x` cannot reach a request.
 *
 * The two values the API reads as "no filter" (`all`, `none`) are defaults in
 * every enum, so a screen with nothing chosen is a clean path such as
 * `/admin/newsletter`, never `?status=all&page=1`.
 *
 * The React half (`useAdminListParams`) lives in `hooks/use-admin-list-params`.
 */
export const LIST_PARAM = {
  page: "page",
  limit: "limit",
  searchTerm: "searchTerm",
  status: "status",
  role: "role",
  within: "within",
  sort: "sort",
} as const;

/**
 * The inbox tab: `TContactStatus` widened by "all". Kept here so a schema does
 * not spell the list out by hand and drift from what the API validates.
 */
export type TMessageFilter = TAdminMessageFilter;

/** The values `cleanFilter` drops before a request, so they mean "no filter". */
const NEUTRAL_VALUES = new Set(["", "all", "none"]);

/** A page of zero reads as "no cap" in the API, which no screen wants from a URL. */
const MAX_PAGE = 1_000_000;

/** Room for the longest search the API accepts. */
const MAX_TEXT = 120;

/**
 * A sort is a field name with an optional `-` prefix, or a comma list of them.
 * Bounded here because the API answers 400 for a field it does not know.
 */
const SORT_PATTERN =
  /^-?[A-Za-z][A-Za-z0-9_]{0,39}(,-?[A-Za-z][A-Za-z0-9_]{0,39}){0,4}$/;

/**
 * Where a read gets its values. `URLSearchParams` (and Next's read-only copy),
 * only through its own interface: a structural `Pick<URLSearchParams, "get">`
 * would accept a detached `get`, whose `this` is lost and which throws on every
 * call, and the throw would read as "the URL has nothing valid".
 */
export type TListParamSource = URLSearchParams | ReadonlyURLSearchParams;

/** How one declared param is read from and written to the URL. */
export type TListParamKind<T> =
  | {
      type: "enum";
      /** Every value the API accepts for this param. */
      values: readonly T[];
    }
  | {
      type: "int";
      /** Inclusive bounds, checked on read and on a set. */
      min?: number;
      max?: number;
      /** The only values accepted, if the param has fixed choices. */
      allowed?: readonly number[];
    }
  | { type: "text"; /** Longest value kept. */ maxLength?: number }
  | {
      type: "sort";
      /** Longest comma list of fields kept. */ maxFields?: number;
    };

/**
 * One param a screen owns. `T` is the type the screen sees: a literal union for
 * an enum, `number` for `int`, `string` otherwise.
 */
export interface IListParam<T> {
  /**
   * The URL key. Left out, the param's name in the schema is used, which is the
   * usual case: `status: listParam(...)` reads and writes `?status=`.
   */
  key?: string;
  kind: TListParamKind<T>;
  /** The value used when the URL has nothing valid; omitted from the URL. */
  default: T;
  /**
   * True for a filter (status, role, search, page size): changing it sends the
   * reader back to page 1 in the same URL write. False for `page` itself and
   * for any param that narrows a tab rather than switches it.
   */
  resetsPage?: boolean;
}

/** A screen's params, keyed by the name the screen reads them under. */
export type TListSchema = Record<string, IListParam<unknown>>;

type TParamOf<T> = T extends IListParam<infer U> ? U : never;

/** The parsed values of a schema, keyed and typed like the schema. */
export type TListValues<S extends TListSchema> = {
  [K in keyof S]: TParamOf<S[K]>;
};

/**
 * Builds a param declaration without widening it. `default` is checked against
 * the declared values, so `{ values: ["all"], default: "All" }` is a type error
 * rather than a URL that always reads back as the default.
 *
 * The shape carries the kind: `values` makes an enum, a numeric `default` makes
 * an int, `maxFields` makes a sort, anything else is text.
 */
export type TListParamInput =
  | {
      key?: string;
      /** In the order the screen lists them: "all" is the absence of a filter. */
      values: readonly string[];
      default: string;
      resetsPage?: boolean;
    }
  | {
      key?: string;
      default: number;
      resetsPage?: boolean;
      /** Inclusive bounds; defaults are 1 and 1,000,000. */
      min?: number;
      max?: number;
      /** Fixed choices, such as `PAGE_SIZES`. Wins over `min` and `max`. */
      allowed?: readonly number[];
    }
  | {
      key?: string;
      default: string;
      resetsPage?: boolean;
      /** Kept to the first N characters, 120 by default. */
      maxLength?: number;
      /** Narrows a tab rather than switching it, so it does not reset the page. */
      narrows?: boolean;
    }
  | {
      key?: string;
      default: string;
      resetsPage?: boolean;
      /** Field names accepted, 5 by default. */
      maxFields: number;
    };

type TMember<T> = NonNullable<T>;

/**
 * True for a union of two or more members. A distribution is what makes a union
 * distinct from its members; a single member distributes to itself and both
 * branches meet, so the members collapse back to `never`.
 */
type TIsUnion<T, U = T> = T extends unknown
  ? [U] extends [T]
    ? false
    : true
  : never;

/**
 * Declares one param. The union comes from `values` as written; `default` is
 * checked against it rather than typing it, so a typo is an error and not a
 * second member of the union, and a value set from a click narrows as usual.
 *
 * Write the values inline. Generic inference widens a typed `readonly T[]`
 * variable to its element type, so a schema built from one accepts any string
 * at compile time (the URL still rejects it at run time).
 *
 * The second parameter exists only while `values` holds a single member: the
 * declaration is then contradictory and an error at the call, which is how a
 * declaration that inference collapsed gets caught.
 */
export function listParam<T extends string>(
  param: {
    key?: string;
    values: readonly T[];
    default: NoInfer<TMember<T>>;
    resetsPage?: boolean;
  },
  ...collapsed: TIsUnion<T> extends true ? [] : [never]
): IListParam<TMember<T>>;
export function listParam(param: {
  key?: string;
  default: number;
  resetsPage?: boolean;
  min?: number;
  max?: number;
  allowed?: readonly number[];
}): IListParam<number>;
export function listParam(param: {
  key?: string;
  default: string;
  resetsPage?: boolean;
  maxLength?: number;
  maxFields?: number;
  narrows?: boolean;
}): IListParam<string>;
export function listParam(param: TListParamInput): IListParam<unknown> {
  const { key, resetsPage } = param;
  const { values } = param as { values?: readonly string[] };
  // `default` is reserved as a binding name, so this cannot destructure it.
  const fallback = param.default;
  const asParam = (kind: TListParamKind<unknown>): IListParam<unknown> => ({
    key,
    kind,
    default: fallback,
    resetsPage: "narrows" in param ? !param.narrows : resetsPage,
  });

  if (values) return asParam({ type: "enum", values });

  if (typeof fallback === "number") {
    const { allowed, min, max } = param as {
      allowed?: readonly number[];
      min?: number;
      max?: number;
    };
    return asParam(
      allowed
        ? { type: "int", allowed }
        : { type: "int", min: min ?? 1, max: max ?? MAX_PAGE },
    );
  }

  const { maxFields, maxLength } = param as {
    maxFields?: number;
    maxLength?: number;
  };
  return asParam(
    maxFields
      ? { type: "sort", maxFields }
      : { type: "text", maxLength: maxLength ?? MAX_TEXT },
  );
}

const readInt = (
  raw: string | null,
  kind: Extract<TListParamKind<number>, { type: "int" }>,
) => {
  if (raw === null || !/^\d{1,7}$/.test(raw)) return undefined;
  const value = Number(raw);
  if (kind.allowed) return kind.allowed.includes(value) ? value : undefined;

  const min = kind.min ?? 1;
  const max = kind.max ?? MAX_PAGE;
  return value >= min && value <= max ? value : undefined;
};

/** A control character would reach a request as-is; none belongs in a filter. */
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

const readText = (raw: string | null, kind: TListParamKind<string>) => {
  const limit = kind.type === "text" ? (kind.maxLength ?? MAX_TEXT) : MAX_TEXT;
  const value = raw?.trim().slice(0, limit);
  return value && !CONTROL_CHARS.test(value) ? value : undefined;
};

const readSort = (raw: string | null, kind: TListParamKind<string>) => {
  const value = raw?.trim();
  if (!value) return undefined;

  const limit = kind.type === "sort" ? (kind.maxFields ?? 5) : 5;
  return value.split(",").length <= limit && SORT_PATTERN.test(value)
    ? value
    : undefined;
};

/** The URL key of a param: its own, or its name in the schema. */
const keyOf = (name: string, param: IListParam<unknown>) => param.key ?? name;

const readRaw = <T>(
  name: string,
  param: IListParam<T>,
  source: TListParamSource,
): T => {
  const raw = source.get(keyOf(name, param));
  const kind = param.kind;

  switch (kind.type) {
    case "enum":
      return kind.values.find((value) => value === raw) ?? param.default;
    case "int":
      return (readInt(raw, kind) ?? param.default) as T;
    case "sort":
      return (readSort(raw, kind) ?? param.default) as T;
    case "text":
      return (readText(raw, kind) ?? param.default) as T;
  }
};

/** Whether a value means "no filter", which is never written to the URL. */
const isNeutral = (value: unknown) =>
  typeof value !== "string" || value.trim() === "" || NEUTRAL_VALUES.has(value);

const sameValue = (a: unknown, b: unknown) => String(a) === String(b);

/**
 * The param that goes back to page 1, found by its URL key rather than by a
 * screen-specific name, so a schema cannot declare the reset under an alias.
 * A screen that names no `page` has nothing to reset.
 */
const pageNameOf = (schema: TListSchema) =>
  Object.keys(schema).find(
    (name) => keyOf(name, schema[name]) === LIST_PARAM.page,
  );

const writeRaw = <T>(
  params: URLSearchParams,
  name: string,
  param: IListParam<T>,
  value: T,
) => {
  const key = keyOf(name, param);
  if (isNeutral(value) || sameValue(value, param.default)) {
    params.delete(key);
    return;
  }

  params.set(key, String(value));
};

/**
 * Reads a schema out of a query string. Every declared param is present in the
 * answer, with its default when the URL has nothing valid.
 */
export const parseListParams = <S extends TListSchema>(
  schema: S,
  source: TListParamSource,
): TListValues<S> => {
  const values: Record<string, unknown> = {};
  for (const [name, param] of Object.entries(schema)) {
    values[name] = readRaw(name, param, source);
  }

  return values as TListValues<S>;
};

const defaultsOf = <S extends TListSchema>(schema: S): TListValues<S> => {
  const values: Record<string, unknown> = {};
  for (const [name, param] of Object.entries(schema)) {
    values[name] = param.default;
  }

  return values as TListValues<S>;
};

/** The values a schema declares as defaults, with no URL read. */
export const listDefaults = defaultsOf;

/**
 * Writes a full set of values into a query string.
 *
 * A default (and `all`, `none`, `""` for a text param) is deleted rather than
 * written, so a screen with no filter is a clean path. Every key the schema
 * owns is rewritten, which is what lets a reset remove a stale value.
 */
export const serializeListParams = <S extends TListSchema>(
  schema: S,
  values: TListValues<S>,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams => {
  const params = new URLSearchParams(base);

  for (const [name, param] of Object.entries(schema)) {
    writeRaw(params, name, param, values[name]);
  }

  return params;
};

/**
 * Applies a partial update to the current URL.
 *
 * A value that is not valid for its param falls back to the default instead
 * of reaching the URL. Changing a `resetsPage` param puts `page` back to its
 * default in the same write; changing `page` alone leaves every other value
 * as it is, and a value already equal to the current one writes nothing.
 *
 * Params the schema does not name (including their repeats) are carried over
 * unchanged.
 */
export const mergeListParams = <S extends TListSchema>(
  schema: S,
  current: URLSearchParams,
  update: Partial<TListValues<S>>,
): URLSearchParams => {
  const values = parseListParams(schema, current) as Record<string, unknown>;

  let filterChanged = false;
  for (const [name, next] of Object.entries(update)) {
    const param = schema[name];
    if (!param || next === undefined) continue;

    const value = readRaw(
      name,
      param,
      new URLSearchParams([[keyOf(name, param), String(next)]]),
    );
    if (sameValue(value, values[name])) continue;

    values[name] = value;
    if (param.resetsPage) filterChanged = true;
  }

  const pageName = pageNameOf(schema);
  // A filter change and the page reset are one URL, so the list never asks for
  // page 3 of a tab that has one page.
  if (filterChanged && pageName && update[pageName as keyof S] === undefined) {
    values[pageName] = schema[pageName].default;
  }

  return serializeListParams(schema, values as TListValues<S>, current);
};

/** Back to the defaults. Params the schema does not name are kept. */
export const resetListParams = <S extends TListSchema>(
  schema: S,
  current: URLSearchParams,
): URLSearchParams => serializeListParams(schema, defaultsOf(schema), current);

/** The address a screen navigates to, with the query dropped when it is empty. */
export const listHref = (pathname: string, params: URLSearchParams) => {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};
