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

const UpVoteButton = ({ children, counts, ...props }: IProps) => (
  <VoteButton
    {...props}
    counts={counts}
    voteType="upvote"
    label="Upvote this article"
    activeLabel="Remove your upvote"
    radius="full"
    variant="light"
    className={`h-9 ${props.className ?? ""}`}
  >
    {children}
  </VoteButton>
);

export default UpVoteButton;
