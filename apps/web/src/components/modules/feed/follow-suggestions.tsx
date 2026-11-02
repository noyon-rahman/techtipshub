"use client";

import FollowUnFollowButton from "@/components/ui/follow-unfollow-button";
import type { IUser } from "@/types";
import Link from "next/link";
import { FaArrowRight } from "react-icons/fa";

interface IProps {
  authors: IUser[];
}

/**
 * The follow list when the reader follows nobody.
 *
 * Three writers whose articles the ranking already leads with, each with the
 * same Follow control the article pages use, so the first follow can be made
 * here and the list fills itself on the next visit. The names link to the
 * member's page, where the rest of their work is.
 *
 * Nothing is suggested about numbers: these are the writers the site's own
 * ranking has put in front of every reader, which is a true statement about
 * them and needs no invented popularity claim.
 */
const FollowSuggestions = ({ authors }: IProps) => {
  return (
    <div className="mt-6 rounded-xl border border-default/60 px-5 py-8 sm:px-6">
      <h2 className="text-lg font-semibold tracking-tight">
        You are not following anyone yet
      </h2>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-default-600">
        Follow a few writers and their new articles appear here, newest first.
      </p>

      {authors.length > 0 && (
        <>
          <p className="mt-6 tth-label-sm text-default-600">
            Writers worth following
          </p>
          <ul className="mt-2 divide-y divide-default/60">
            {authors.map((author) => (
              <li
                key={author._id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/@${author.username}`}
                    className="font-medium text-foreground underline decoration-transparent underline-offset-2 hover:decoration-current"
                  >
                    {author.fullName || author.username}
                  </Link>
                  <p className="truncate text-sm text-default-600">
                    @{author.username}
                    {author.designation ? ` · ${author.designation}` : ""}
                  </p>
                </div>

                {author._id && (
                  <div className="w-28 shrink-0">
                    <FollowUnFollowButton
                      id={author._id}
                      label={author.fullName || author.username}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        href="/features"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline decoration-default-400 underline-offset-2 hover:decoration-foreground"
      >
        Find more writers in the community
        <FaArrowRight aria-hidden className="size-3" />
      </Link>
    </div>
  );
};

export default FollowSuggestions;
