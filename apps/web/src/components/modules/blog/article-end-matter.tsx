"use client";

import BlogShare from "@/components/modules/blog/blog-share";
import CommentJumpButton from "@/components/modules/blog/comment-jump-button";
import NewsletterSignup from "@/components/modules/newsletter/newsletter-signup";
import ButtonLink from "@/components/ui/button-link";
import DownVoteButton from "@/components/ui/downvote-button";
import FollowUnFollowButton from "@/components/ui/follow-unfollow-button";
import PrintBlogButton from "@/components/ui/print-blog-button";
import UpVoteButton from "@/components/ui/upvote-button";
import UserAvatar from "@/components/ui/user-avatar";
import { useUser } from "@/context/user.provider";
import type { IVoteCounts } from "@/hooks/blog.hook";
import { searchPath } from "@/lib/feed-routes";
import type { IBlog } from "@/types";
import type { IUser } from "@/types/user.type";
import { formatBlogDate } from "@/utils";
import Link from "next/link";
import { BiDownvote, BiUpvote } from "react-icons/bi";
import { FiArrowUp } from "react-icons/fi";

/**
 * One vote for a reader's eye: the icon, and its total inside the same press
 * target. A count parked next to the button read as a separate thing and
 * shifted whenever it appeared, so it lives in the button as a badge.
 */
const VoteCount = ({ label, value }: { label: string; value: number }) => (
  <span className="min-w-2 text-xs font-medium tabular-nums">
    {value > 0 && <span aria-hidden>{value.toLocaleString()}</span>}
    <span className="sr-only">
      {value === 1
        ? `${value} ${label.replace(/s$/, "")}`
        : `${value} ${label}`}
    </span>
  </span>
);

interface EndMatterProps {
  blog: IBlog;
}

/**
 * What the reader can do once the article ends: say whether it helped, talk
 * about it, take it with them. One ruled block, quiet controls, no card.
 *
 * It is a client component because the vote totals move on a press. The
 * article page itself stays prerendered: the counts below arrive with it, and
 * each control asks the API for this reader's own vote once it is on screen.
 */
export const ArticleEndMatter = ({ blog }: EndMatterProps) => {
  const { user } = useUser();
  const { _id, slug, title, upVotes, downVotes, totalComments, author } = blog;

  const counts: IVoteCounts = {
    upVotes: upVotes ?? 0,
    downVotes: downVotes ?? 0,
    myVote: null,
  };

  // The API refuses an author's vote on their own article, so the totals are
  // shown to them without the two buttons.
  const isOwnArticle = Boolean(user && author?._id === user._id);

  return (
    <section
      aria-labelledby="article-end-matter"
      className="mt-14 border-t border-default/60 pt-6 print:hidden"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="article-end-matter" className="tth-label mr-1">
            Was this useful?
          </h2>
          {/* One control per vote: the arrow and its total share a single press
              target, so the count cannot drift away from the button it belongs
              to, and nothing moves when a count goes from nothing to a value. */}
          {isOwnArticle ? (
            <>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-default-200 px-2.5 text-xs font-medium text-default-600">
                <BiUpvote aria-hidden className="text-lg" />
                <VoteCount label="upvotes" value={counts.upVotes} />
              </span>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-default-200 px-2.5 text-xs font-medium text-default-600">
                <BiDownvote aria-hidden className="text-lg" />
                <VoteCount label="downvotes" value={counts.downVotes} />
              </span>
              <span className="text-xs text-default-600">Your own article</span>
            </>
          ) : (
            <>
              <UpVoteButton blogId={_id} slug={slug} counts={counts}>
                <BiUpvote aria-hidden className="text-lg" />
              </UpVoteButton>
              <DownVoteButton blogId={_id} slug={slug} counts={counts}>
                <BiDownvote aria-hidden className="text-lg" />
              </DownVoteButton>
            </>
          )}
        </div>

        {/* The existing controls keep their own props; this wrapper only lifts
            their hit area to the 44px touch minimum. */}
        <div className="flex flex-wrap items-center gap-1 [&_button]:min-h-11 [&_button]:min-w-11">
          <CommentJumpButton count={totalComments ?? 0} />
          <BlogShare path={`/blogs/${slug}`} title={title} />
          <PrintBlogButton blog={blog} />
        </div>
      </div>
    </section>
  );
};

export const ArticleTags = ({ tags }: { tags?: string[] }) => {
  if (!tags || tags.length === 0) return null;

  return (
    <nav
      aria-label="Tags"
      className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-2 print:hidden"
    >
      <span className="tth-label-sm">Tagged</span>
      {tags.map((tag) => (
        <Link
          key={tag}
          href={searchPath(tag)}
          // A chip stays visually small per DESIGN.md; the `::before` gives it a
          // 44px tall touch area that overlaps the row's 44px line box.
          className="relative inline-flex max-w-full cursor-pointer items-center truncate rounded-full border border-default/60 px-2.5 py-0.5 text-xs text-default-700 transition-colors before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] hover:border-default-300 hover:bg-default-100 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          #{tag}
        </Link>
      ))}
    </nav>
  );
};

/**
 * The newsletter, at the end of an article.
 *
 * A reader who has just finished something is the one most likely to want the
 * next one, so this sits after the tags and before the author panel. It is a
 * ruled block, not a card, so it does not compete with that panel.
 */
export const ArticleNewsletter = () => (
  <section aria-label="Newsletter" className="mt-10 print:hidden">
    <NewsletterSignup
      title="Get the next one in your inbox"
      description="One email a month with the articles worth your time. No daily mail."
    />
  </section>
);

/**
 * Who wrote this, at the end of it.
 *
 * This is the block that turns a reader into a follower, so it carries real
 * identity rather than a line of text: portrait, display-face name, the facts
 * that decide "should I follow this person" (designation, member since,
 * followers), then the bio. It is a panel, not a list: the warm `content1`
 * surface and slate-grey hairline used by the site's other raised surfaces,
 * 10px radius, no shadow. Follow leads the actions when the reader is not the
 * author; View profile is always there.
 *
 * Layout is a short stack, not a media object: the portrait and name share a
 * row, and the facts and actions sit under them with the button on the text
 * axis. A 44px button parked at the card's right edge used to set the height
 * of the name row and leave a dead column across the middle of the panel.
 */
export const ArticleAuthor = ({
  author,
  isOwnArticle = false,
}: {
  author?: Partial<IUser>;
  isOwnArticle?: boolean;
}) => {
  if (!author?.username) return null;

  const profileHref = `/users/@${author.username}`;
  const memberSince = formatBlogDate(author.createdAt);
  const followers = author.totalFollowers;

  return (
    <section
      aria-labelledby="article-author"
      className="tth-panel mt-14 px-5 py-5 sm:px-6 print:hidden"
    >
      <h2 id="article-author" className="tth-label">
        Written by
      </h2>

      <div className="mt-2 flex items-center gap-3">
        {/* Visual only: the name below and "View profile" are the real links. */}
        <Link href={profileHref} tabIndex={-1} aria-hidden className="shrink-0">
          <UserAvatar
            className="size-10"
            radius="full"
            src={author.profilePicture}
            name={author.fullName}
            showFallback
          />
        </Link>

        <div className="min-w-0 flex-1">
          <p className="truncate font-[family-name:var(--type-editorial)] text-base font-semibold leading-tight tracking-[-0.01em]">
            <Link
              href={profileHref}
              className="transition-colors hover:text-primary-accessible focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {author.fullName}
            </Link>
          </p>
          <p className="mt-0.5 truncate font-sans text-xs leading-4 text-default-600">
            @{author.username}
            {author.designation && (
              <>
                <span aria-hidden className="mx-1.5 text-default-300">
                  ·
                </span>
                {author.designation}
              </>
            )}
          </p>
        </div>
      </div>

      {author.bio && (
        <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-default-700">
          {author.bio}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs leading-4 text-default-600">
          {typeof followers === "number" && followers > 0 && (
            <span className="tabular-nums">
              {followers.toLocaleString()}{" "}
              {followers === 1 ? "follower" : "followers"}
            </span>
          )}
          {typeof followers === "number" && followers > 0 && memberSince && (
            <span aria-hidden className="text-default-300">
              ·
            </span>
          )}
          {memberSince && <span>Joined {memberSince}</span>}
        </p>

        {/* The controls keep their own logic; this only stops them stretching
            to the row width and gives them a compact 36px box. */}
        <div className="ml-auto flex flex-wrap items-center gap-2 [&_a]:!h-9 [&_button]:!h-9 [&_a]:w-auto [&_button]:w-auto [&_.w-full]:w-auto">
          {!isOwnArticle && author._id && (
            <FollowUnFollowButton id={author._id} />
          )}
          <ButtonLink
            href={profileHref}
            variant="bordered"
            size="sm"
            className="!h-9"
          >
            View profile
          </ButtonLink>
        </div>
      </div>
    </section>
  );
};

/**
 * A link back to the article title, for readers who arrive at the discussion
 * first (from a comment notification) or want the headline again.
 */
export const BackToTop = () => (
  <p className="mt-12 print:hidden">
    <a
      href="#article-start"
      className="inline-flex min-h-11 items-center gap-1.5 text-sm text-default-600 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <FiArrowUp aria-hidden className="size-4" />
      Back to the top
    </a>
  </p>
);
