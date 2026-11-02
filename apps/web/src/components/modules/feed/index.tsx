"use client";

import { AdSlot } from "@/components/adsense";
import BlogCard from "@/components/blog-card";
import BlogCardSkeleton from "@/components/blog-card/skeleton";
import { readFeedPageAction } from "@/services/reader/feed-action";
import { ownProfilePath } from "@/lib/blog-routes";
import { personalFeedPath } from "@/lib/feed-routes";
import { IBlog, TFeedReason } from "@/types";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";

interface IProps {
  /** The page as rendered on the server: the order every reader gets. */
  initialBlogs: IBlog[];
  /** Set by `/categories/<name>`: the filter is in the URL, not a query. */
  category?: string;
  /** Set by `/search`: the term is in the URL, not a query. */
  searchTerm?: string;
  /**
   * `newest` for the screens that mean it (search results, a category page).
   * Left off on the feed, where the order is the ranking.
   */
  sort?: "ranking" | "newest";
  /** The page's own name, for the heading. The landing page is "All". */
  title?: string;
  /** The follow list: newest first, and the reason line says so. */
  isFollowing?: boolean;
}

/** Articles fetched per scroll, and per first page. The end is `fewer than this came back`. */
const PAGE_SIZE = 10;

/**
 * The feed list.
 *
 * The document is prerendered for everyone, so the first paint is the order a
 * signed-out reader gets. Once it is in the browser, a server action asks for
 * the page that belongs to whoever is reading: interest first for a signed-in
 * reader who chose topics, the engagement order for everyone else. The swap
 * happens only when the answer is actually theirs, so a signed-out reader's
 * list never flickers into something else and then back.
 *
 * Paging stays inside the order it started in: every later page is asked for
 * through the same action, with the same sort. Every request is one page of
 * `PAGE_SIZE`, the first one included, so a page of cards is never two shapes.
 */
const FeedBlogs = ({
  initialBlogs,
  category,
  searchTerm,
  sort,
  title = "All",
  isFollowing = false,
}: IProps) => {
  const [page, setPage] = useState(2);
  const [blogs, setBlogs] = useState<IBlog[]>(initialBlogs);
  const [hasMore, setHasMore] = useState(true);
  const [reason, setReason] = useState<TFeedReason>("engagement");
  // The signed-in reader's handle, once the action has answered. It is how the
  // reason line can point at their own topics instead of just naming them.
  const [username, setUsername] = useState<string | null>(null);
  const { ref, inView } = useInView();

  // The reason line names a topic only when it can read one off the page itself.
  const topTopic = (list: IBlog[]) => list[0]?.category?.name;

  // One request per mount. The ref survives StrictMode's second effect run in
  // development, so the list is not asked for twice.
  const asked = useRef(false);

  const request = (nextPage: number) => ({
    page: nextPage,
    limit: PAGE_SIZE,
    category,
    searchTerm,
    // The follow list is already in its order on the server render, and its
    // next pages come from the same public list with the same sort.
    sort: isFollowing ? "newest" : sort,
  });

  // The reader's own first page. The follow list already arrived in its own
  // order, so it only asks for more when the reader scrolls.
  useEffect(() => {
    if (isFollowing || asked.current) return;
    asked.current = true;

    readFeedPageAction(request(1))
      .then((answer) => {
        if (!answer) return;

        setUsername(answer.username ?? null);

        // The swap is worth making only when it changes something: every page
        // is now the same size, so the reason alone decides it. (When the first
        // page was smaller than the rest, a same-sized answer meant the
        // reader's own order had nothing more to show.)
        const personalized = answer.reason === "personalized";
        if (!personalized && answer.blogs.length <= initialBlogs.length) {
          setHasMore(answer.blogs.length > 0);
          return;
        }

        setBlogs(answer.blogs as IBlog[]);
        setReason(answer.reason);
        setPage(2);
        setHasMore(answer.blogs.length > 0);
      })
      .catch(() => {
        // The prerendered page stands, which is a complete list on its own.
      });
    // `initialBlogs`, `category`, `searchTerm` and `sort` come from the page
    // that rendered this list, so a new one is a new mount, not a new request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loadMoreBlogs = async () => {
    if (!hasMore) return;

    try {
      const answer = await readFeedPageAction(request(page));
      const newBlogs = (answer?.blogs as IBlog[] | undefined) ?? [];

      setBlogs((prevBlogs) => [...prevBlogs, ...newBlogs]);
      setPage((prevPage) => prevPage + 1);

      // Stop further fetching if fewer blogs than the limit are returned.
      if (newBlogs.length < PAGE_SIZE) {
        setHasMore(false);
      }
    } catch {
      setHasMore(false);
    }
  };

  useEffect(() => {
    if (inView && hasMore) {
      loadMoreBlogs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hasMore]);

  const filtered = Boolean(searchTerm || category);

  const heading = searchTerm
    ? `Results for "${searchTerm}"`
    : category
      ? category.replace(/-/g, " ")
      : title;

  const topic = topTopic(blogs);
  const because = reason === "personalized" && topic;
  // The topic name is the reader's way into their own choice: it is the moment
  // they think "actually, more than that". A signed-out reader gets the plain
  // sentence, because there is nothing of theirs to change yet.
  const description =
    searchTerm || category ? (
      searchTerm ? (
        "Articles matching your search, newest first."
      ) : (
        `${category?.replace(/-/g, " ")} articles, newest first.`
      )
    ) : isFollowing ? (
      "Newest first, from the writers you follow."
    ) : title === "Personalized" ? (
      because ? (
        <>
          Because you follow{" "}
          <Link
            href={`${ownProfilePath}#topics`}
            className="font-medium text-foreground underline decoration-default-400 underline-offset-2 hover:decoration-foreground"
          >
            {topic}
          </Link>
          . The rest follows in the order every reader gets.
        </>
      ) : (
        "Pick topics on your profile and they lead here. Until then, the order every reader gets."
      )
    ) : because ? (
      <>
        Because you follow{" "}
        <Link
          href={`${ownProfilePath}#topics`}
          className="font-medium text-foreground underline decoration-default-400 underline-offset-2 hover:decoration-foreground"
        >
          {topic}
        </Link>
        .
      </>
    ) : (
      "What readers are reading and voting for, newest writing first."
    );

  return (
    <div className="w-full">
      <header className="mb-6 border-b border-default/60 pb-4">
        <h1 className="font-[family-name:var(--type-editorial)] text-3xl font-semibold leading-[1.1] tracking-[-0.01em]">
          {heading}
        </h1>
        <p className="mt-1 text-sm text-default-600">{description}</p>

        {/* `All` holds everything published, so it is the one place a reader
            with topics can be pointed at the list built from them. It is left
            off the personalized list itself, where it would point at the page
            the reader is already on. */}
        {!filtered && !isFollowing && title === "All" && username && (
          <Link
            href={personalFeedPath}
            className="mt-2 inline-block text-sm font-medium text-default-700 underline decoration-default-400 underline-offset-2 hover:text-foreground hover:decoration-foreground"
          >
            Want your topics first? Open Personalized
          </Link>
        )}
      </header>
      <div className="divide-y divide-default/60">
        {blogs.map((blog, index) => (
          <Fragment key={blog?._id}>
            <div className="py-6 first:pt-0">
              <BlogCard {...blog} />
            </div>
            {/* One unit per four cards, after the fourth card. The leading
                `blogs.length > 4` check keeps a short feed ad free. */}
            {blogs.length > 4 && (index + 1) % 4 === 0 && (
              <div className="pb-6">
                <AdSlot
                  placement="feed-inline"
                  className="mt-0 rounded-[10px] border border-default/60 bg-default-50/30 px-3 pb-3"
                />
              </div>
            )}
          </Fragment>
        ))}
      </div>
      <div className="py-6 text-center text-sm text-default-600" ref={ref}>
        {hasMore ? (
          <div className="space-y-6">
            <BlogCardSkeleton />
            <BlogCardSkeleton />
          </div>
        ) : (
          blogs.length > 0 &&
          (filtered
            ? "You've reached the end of these results."
            : "You've reached the end of the feed.")
        )}
      </div>
    </div>
  );
};

export default FeedBlogs;
