"use client";

import type { IVoteCounts } from "@/hooks/blog.hook";
import { ReactNode } from "react";
import VoteButton from "./vote-button";

interface IProps {
  children: ReactNode;
  blogId: string;
  slug?: string;
  /** The totals the page was rendered with. */
  counts: IVoteCounts;
  className?: string;
}

const DownVoteButton = ({ children, counts, ...props }: IProps) => (
  <VoteButton
    {...props}
    counts={counts}
    voteType="downvote"
    label="Downvote this article"
    activeLabel="Remove your downvote"
    radius="full"
    variant="light"
    className={`h-9 ${props.className ?? ""}`}
  >
    {children}
  </VoteButton>
);

export default DownVoteButton;
