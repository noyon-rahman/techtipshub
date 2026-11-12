import type { TArticleAccess } from "@techtipshub/shared";

/**
 * How much of an article a reader is allowed to see, and where the parts of
 * that decision live.
 *
 * A members-only article is prerendered with the whole body in it and served
 * from the CDN. Whether a particular visitor sees that body is decided after
 * the document arrives, on the server, from the visitor's own session - see
 * `ArticleAccess`. The response as a whole stays a plain static document, so
 * the CDN keeps serving it to everyone.
 *
 * If that check cannot be reached (scripting off, or an older cached document
 * without it), the visitor is shown the members prompt rather than the
 * article: the cached page carries the body for members, not for the public.
 *
 * A public article skips all of that: the page renders the full body for
 * everyone and is the canonical, indexable address it lives at.
 */

/** How much of an article a visitor gets. */
export type ArticleView = "guest" | "member";

/**
 * The `?view=preview` variant of an article URL.
 *
 * This is what search engines are pointed at for a members-only article. They
 * never run the reader check, so on the plain URL they would be handed the
 * bare page - a page with no article text. The preview is rendered on the
 * server with the introduction and nothing after it, so the indexable page has
 * real content while the full body stays for members.
 */
export const ARTICLE_PREVIEW_PARAM = "view";
export const ARTICLE_PREVIEW_VALUE = "preview";

/** The preview variant of an article address. */
export const articlePreviewPath = (slug: string) =>
  `/blogs/${encodeURIComponent(slug)}?${ARTICLE_PREVIEW_PARAM}=${ARTICLE_PREVIEW_VALUE}`;

/** The address an article lives at, with no variant on it. */
export const articlePath = (slug: string) =>
  `/blogs/${encodeURIComponent(slug)}`;

/**
 * The stored access, with a missing value read as members only. Rows written
 * before access was a choice carry no value and behaved that way.
 */
export const articleAccessOf = (article?: {
  access?: TArticleAccess;
}): TArticleAccess => (article?.access === "public" ? "public" : "members");

/**
 * The address search engines and link unfurls should hold: the plain article
 * address for every article. Members-only articles already render their
 * preview server-side at the plain URL (with the full body hidden until the
 * browser's session check passes), so `?view=preview` is no longer needed as a
 * separate canonical target.
 */
export const articleIndexablePath = (slug: string, _access?: TArticleAccess) =>
  articlePath(slug);
