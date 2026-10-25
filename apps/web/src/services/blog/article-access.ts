"use server";

import { readReaderSession } from "@/lib/reader-session";

export interface ArticleAccessResult {
  /** Whether this request carries a session. */
  member: boolean;
  /**
   * Whether the body may be shown. Only a signed-in browser gets it: a crawler
   * has no session, and a request that is not a browser is not the person the
   * page is for.
   */
  canRead: boolean;
}

/**
 * The reader's own answer to "may I read this article".
 *
 * An article page is prerendered once and served from the CDN to everyone, so
 * it cannot ask who is reading while it is built. This action does instead: it
 * runs on the server inside the page the browser already holds, reads that
 * request's session cookie, and returns the answer. The page around it is not
 * re-rendered; only the small client component that calls this changes.
 *
 * The answer is the cookie read and nothing else. Counting a view is not part
 * of deciding what to show, and it belongs to one place only: `BlogViewCounter`
 * records it from the browser, which is also where a guest's visitor id lives.
 */
export const resolveArticleAccess = async (
): Promise<ArticleAccessResult> => {
  const session = await readReaderSession();

  if (!session.reader) {
    return { member: session.member, canRead: false };
  }

  return { member: session.member, canRead: session.member };
};
