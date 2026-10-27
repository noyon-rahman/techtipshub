"use client";

import { useUser } from "@/context/user.provider";
import { useVoteState } from "@/hooks/blog.hook";
import type { IVoteCounts } from "@/hooks/blog.hook";
import type { TVoteType } from "@/types";
import { Button, ButtonProps } from "@heroui/react";
import { ReactNode } from "react";
import { AuthenticationModal } from "../modals";

interface IProps extends Omit<ButtonProps, "onPress" | "isLoading"> {
  blogId: string;
  slug?: string;
  /** The totals the page was rendered with. Only used until the API answers. */
  counts: IVoteCounts;
  /** The arrow. The button draws it beside the count itself. */
  children: ReactNode;
}

/**
 * One vote: the arrow and its total in a single press target.
 *
 * The press lands immediately: the count and the pressed state change before
 * the request leaves, and go back if the write fails (`useVoteState` owns
 * that). Nothing spins, and rapid presses never fan out into one request each;
 * the hook folds them (see `useVoteState`).
 *
 * The pressed colour is a class scoped to beat HeroUI's variant rule; see
 * `.tth-vote-on` / `.tth-vote-down` in globals.css. The count inherits it, so
 * a vote reads as one thing rather than a coloured arrow beside grey text.
 *
 * `aria-pressed` is what tells a screen reader that this reader has already
 * voted. Colour alone would not carry it, and the label says what pressing
 * again does rather than repeating the same word back.
 */
const VoteButton = ({
  children,
  blogId,
  slug,
  counts: pageCounts,
  voteType,
  label,
  activeLabel,
  ...props
}: IProps & {
  voteType: TVoteType;
  /** The action, e.g. "Upvote this article". */
  label: string;
  /** The action once this reader has voted, e.g. "Remove your upvote". */
  activeLabel: string;
}) => {
  const { user } = useUser();
  const { counts, myVote, onVote } = useVoteState(blogId, pageCounts);

  const voted = myVote === voteType;
  const count = voteType === "upvote" ? counts.upVotes : counts.downVotes;

  const pressed = voted
    ? voteType === "upvote"
      ? "tth-vote-on"
      : "tth-vote-down"
    : "text-default-600";

  if (!user) {
    return (
      <AuthenticationModal
        buttonContent={children}
        redirect={slug ? `blogs/${slug}` : undefined}
        aria-label={label}
        {...props}
      />
    );
  }

  // The API refuses an admin's vote, so the control says so up front instead
  // of failing after the press.
  const isAdmin = user.role === "Admin";

  return (
    <Button
      {...props}
      isDisabled={isAdmin || props.isDisabled}
      onPress={() => onVote(voteType)}
      aria-pressed={voted}
      aria-label={voted ? activeLabel : `${label}, ${count} so far`}
      className={`min-w-0 gap-1.5 px-2.5 tabular-nums transition-colors ${props.className ?? ""} ${pressed}`}
    >
      <span className="flex size-5 items-center justify-center">
        {children}
      </span>
      <span className="min-w-2 text-xs font-medium">
        {count > 0 ? count.toLocaleString() : "0"}
      </span>
    </Button>
  );
};

export default VoteButton;
