import envConfig from "@/config/env.config";
import { legacyResponse } from "@/lib/api-contract";
import type { TLegacyBody } from "@/lib/api-contract";
import type { TFeedReason } from "@techtipshub/shared";

/**
 * The reader's own feed page: the same list, in the order that belongs to them.
 *
 * `GET /blogs/feed` is built from the interests on the account, so it needs a
 * token. `GET /blogs` answers the same page to anybody, which is what a reader
 * who skipped the step gets: the engagement order and `reason: "engagement"`.
 *
 * `reason` arrives in `meta` and says where the order came from. It is only
 * `personalized` when the page actually held one of the reader's interests, so
 * the feed can say why it is showing what it is showing without guessing.
 */

export interface IFeedPage {
  blogs: unknown[];
  reason: TFeedReason;
  totalPages?: number;
}

export interface IFeedRequest {
  page: number;
  limit: number;
  category?: string;
  searchTerm?: string;
  /** `newest` for the filtered screens; the ranking is the feed's own order. */
  sort?: "ranking" | "newest";
}

const listUrl = (path: string, request: IFeedRequest) => {
  const url = new URL(`${envConfig.baseApi}/blogs${path}`);

  url.searchParams.set("page", String(request.page));
  url.searchParams.set("limit", String(request.limit));
  if (request.sort) url.searchParams.set("sort", request.sort);
  if (request.category) url.searchParams.set("category", request.category);
  if (request.searchTerm) url.searchParams.set("searchTerm", request.searchTerm);

  return url.toString();
};

const reasonOf = (value: unknown): TFeedReason =>
  value === "personalized" ? "personalized" : "engagement";

const toPage = (body: TLegacyBody<unknown[]> | undefined): IFeedPage | null => {
  if (!body?.success || !Array.isArray(body.data)) return null;

  return {
    blogs: body.data,
    reason: reasonOf(body.meta?.reason),
    ...(typeof body.meta?.totalPages === "number"
      ? { totalPages: body.meta.totalPages }
      : {}),
  };
};

/**
 * One page of the signed-in reader's feed.
 *
 * `null` means the request failed, which is how the caller tells "the reader
 * has no session or the API is down" from "this page is empty".
 */
export const readReaderFeed = async (
  request: IFeedRequest,
  accessToken?: string,
): Promise<IFeedPage | null> => {
  const path = accessToken ? "/feed" : "";

  try {
    const res = await fetch(listUrl(path, request), {
      cache: "no-store",
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    });

    return toPage(await legacyResponse<unknown[]>(res));
  } catch {
    return null;
  }
};
