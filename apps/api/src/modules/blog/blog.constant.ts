import { TBlogStatus, TContentType } from "./blog.interface";

export const BlogContentType: TContentType[] = ["html", "markdown", "text"];
export const blogSearchableFields = ["title", "slug", "content"];

/**
 * Drafts are unfinished pieces only their author and the admins can open.
 * Published is everything else, which is what every row written before this
 * field existed becomes.
 */
export const BlogStatus: TBlogStatus[] = ["draft", "published"];

/**
 * The filter for "a reader may see this": live and not a draft.
 *
 * Deliberately "not a draft" rather than `status: "published"`. Every row
 * written before drafts existed has no stored status, and `{ status:
 * "published" }` does not match a missing field, so equality empties the feed
 * on an existing database. The schema defaults new rows to published, so the
 * only rows without a value are the older ones, and those are live.
 */
export const LIVE_ARTICLE = {
  isDeleted: { $ne: true },
  status: { $ne: "draft" },
} as const;
