import FeedBlogs from "@/components/modules/feed";
import { readReaderSession } from "@/lib/reader-session";
import { readReaderFeed } from "@/services/reader/feed";
import { IBlog } from "@/types";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Personalized",
  description: "The articles on the topics you picked, first. TechTipsHub.",
  // Personal to the signed-in reader; there is nothing stable to index.
  robots: { index: false, follow: false },
};

/** Articles on the first page; the rest load as the reader scrolls, same size. */
const INITIAL_NUMBERS_OF_BLOGS = 10;

/**
 * The reader's own list.
 *
 * Signed in only, so the tab that points here is never shown to someone who
 * cannot open it (`proxy.ts` sends anyone else to sign in). The order comes
 * from `GET /blogs/feed`, which is built from the topics on the account: they
 * lead, and the rest follow in the engagement order.
 *
 * The page is a server render rather than a prerendered shell, because the
 * first card is already different for each reader and a shell would mean two
 * orders painted one after the other.
 */
export default async function PersonalFeedPage() {
  const { accessToken } = await readReaderSession();

  const page = await readReaderFeed(
    { page: 1, limit: INITIAL_NUMBERS_OF_BLOGS },
    accessToken,
  ).catch(() => null);

  const blogs = (page?.blogs as IBlog[] | undefined) ?? [];

  return <FeedBlogs initialBlogs={blogs} title="Personalized" />;
}
