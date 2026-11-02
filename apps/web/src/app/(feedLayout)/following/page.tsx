import FeedBlogs from "@/components/modules/feed";
import FollowSuggestions from "@/components/modules/feed/follow-suggestions";
import { getFollowingUsersBlogs } from "@/services/blog";
import { getAuthorsToFollow } from "@/services/user";
import { readReaderSession } from "@/lib/reader-session";
import { readReaderUsername } from "@/services/reader/interests";
import { IBlog } from "@/types";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Following",
  description:
    "New articles from the writers you follow, newest first. TechTipsHub.",
  // Personal to the signed-in reader; there is nothing stable to index.
  robots: { index: false, follow: false },
};

/** Articles on the first page; the rest load as the reader scrolls. */
const INITIAL_NUMBERS_OF_BLOGS = "10";

/**
 * The follow list.
 *
 * Signed in only (`proxy.ts` sends anyone else to sign in), so the page reads
 * the session directly instead of being prerendered for everybody. The order is
 * the API's: newest first, from the members the reader follows.
 *
 * Two empty states, and they are different facts: following nobody shows
 * writers to follow, while following somebody shows the plain "nothing yet"
 * the article list already draws. The API reports the count of writers, which
 * is what tells them apart.
 */
export default async function FollowingPage() {
  const { accessToken } = await readReaderSession();

  const data = await getFollowingUsersBlogs({
    limit: INITIAL_NUMBERS_OF_BLOGS,
    page: "1",
  });

  const blogs = Array.isArray(data?.data) ? (data.data as IBlog[]) : [];
  const following = Number(data?.meta?.following ?? 0);

  if (following === 0) {
    const username = await readReaderUsername(accessToken);
    const authors = await getAuthorsToFollow(username).catch(() => []);

    return <FollowSuggestions authors={authors} />;
  }

  return (
    <FeedBlogs
      initialBlogs={blogs}
      title="Following"
      isFollowing
      sort="newest"
    />
  );
}
