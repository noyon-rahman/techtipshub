"use server";

import { logAfterResponse, readReaderSession } from "@/lib/reader-session";
import { readReaderFeed, type IFeedPage, type IFeedRequest } from "./feed";
import { readReaderUsername } from "./interests";

/**
 * The feed page for whichever reader is asking.
 *
 * The landing page is prerendered and served to everyone, so it cannot ask who
 * is reading while it is built. It renders the order every reader gets, and
 * this action puts the signed-in reader's own order in place once the page is
 * in the browser: the first page of their feed, and the rest behind the same
 * action as the reader scrolls.
 *
 * A signed-out reader, or a request whose token does not work, is answered by
 * the public list in the same order the page already shows.
 */
export const readFeedPageAction = async (
  request: IFeedRequest,
): Promise<(IFeedPage & { username?: string }) | null> => {
  const { accessToken } = await readReaderSession();

  const [page, username] = await Promise.all([
    readReaderFeed(request, accessToken),
    readReaderUsername(accessToken),
  ]);

  if (!page) {
    logAfterResponse("feed", "The feed page did not load.");
  }

  // The handle rides along so the feed can point a reader at their own topics
  // without a second call; a page without it still renders.
  return page ? { ...page, ...(username ? { username } : {}) } : null;
};
