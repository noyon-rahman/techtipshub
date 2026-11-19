import {
  commentOnBlog,
  createBlog,
  updateBlogByUserUsingId,
  getAllBlogs,
  getVoteStatus,
  voteOnBlog,
  deleteBlogByAdminUsingId,
  deleteBlogByUserUsingId,
  updateBlogByAdmin,
  deleteCommentByUser,
  updateCommentByUser,
} from "@/services/blog";
import { messageOf } from "@/lib/api-error";
import type { IVoteResult, TVoteType } from "@techtipshub/shared";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "@/lib/toast";

export const useCreateBlog = () => {
  return useMutation<any, Error, Record<string, unknown>>({
    mutationKey: ["CREATE_BLOG"],
    mutationFn: async (payload) => await createBlog(payload),
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(
          data?.errorSources?.[0]?.message ||
            data?.message ||
            "We could not create the article.",
          { id: "create-blog" },
        );
      }
      if (data.success) {
        toast.success("Article created.", {
          id: "create-blog",
        });
      }
    },
  });
};

/**
 * A vote, as this reader's control draws it.
 *
 * A vote is a toggle: the same button again takes the vote back, the other one
 * switches it. Where the request lands is therefore decided entirely by what
 * the reader holds now, which is what `applyVote` reads.
 *
 * The two counts are everyone's; `myVote` is this reader's alone. The article
 * page is prerendered and shared, so it cannot carry `myVote` and its totals
 * can be minutes old. The control therefore starts from the page, asks the API
 * once for this reader's answer, and from then on reads the entry below.
 */
export interface IVoteCounts {
  upVotes: number;
  downVotes: number;
  myVote: TVoteType | null;
}

/** Pressing `voteType` on an article whose state is `current`. */
export const applyVote = (
  current: IVoteCounts,
  voteType: TVoteType,
): IVoteCounts => {
  const up = Math.max(0, current.upVotes ?? 0);
  const down = Math.max(0, current.downVotes ?? 0);

  if (current.myVote === voteType) {
    return {
      upVotes: voteType === "upvote" ? Math.max(0, up - 1) : up,
      downVotes: voteType === "downvote" ? Math.max(0, down - 1) : down,
      myVote: null,
    };
  }

  if (voteType === "upvote") {
    return {
      upVotes: up + 1,
      downVotes: current.myVote === "downvote" ? Math.max(0, down - 1) : down,
      myVote: "upvote",
    };
  }

  return {
    upVotes: current.myVote === "upvote" ? Math.max(0, up - 1) : up,
    downVotes: down + 1,
    myVote: "downvote",
  };
};

/**
 * This reader's vote on one article, for the rest of the tab.
 *
 * `settled` is the last answer the API gave, or the state the burst started
 * from while presses are still unfurling. `pending` is the vote the reader is
 * asking for, held with the state before the burst's first press, so the
 * screen draws it and a failure can put that back.
 */
interface IVoteEntry {
  settled?: IVoteCounts;
  pending?: { target: TVoteType; before: IVoteCounts };
}

const voteEntries = new Map<string, IVoteEntry>();
const voteListeners = new Map<string, Set<() => void>>();
// The status read in flight, so a press during it waits for it instead of
// sending a second identical request.
const voteReads = new Map<string, Promise<IVoteCounts | undefined>>();

const setVoteEntry = (blogId: string, entry: IVoteEntry) => {
  voteEntries.set(blogId, entry);
  voteListeners.get(blogId)?.forEach((notify) => notify());
};

const subscribeToVote = (blogId: string, notify: () => void) => {
  const listeners = voteListeners.get(blogId) ?? new Set<() => void>();
  listeners.add(notify);
  voteListeners.set(blogId, listeners);

  return () => {
    listeners.delete(notify);
  };
};

const shapeOf = (body: { data?: IVoteResult } | undefined) =>
  body?.data
    ? {
        upVotes: body.data.upVotes,
        downVotes: body.data.downVotes,
        myVote: body.data.myVote,
      }
    : undefined;

/** The API's answer for this reader and article; one request per article. */
const readVoteStatus = (blogId: string) => {
  const inFlight = voteReads.get(blogId);
  if (inFlight) return inFlight;

  const read = getVoteStatus(blogId)
    .then((body) => (body?.success ? shapeOf(body) : undefined))
    .catch(() => undefined)
    .finally(() => {
      if (voteReads.get(blogId) === read) voteReads.delete(blogId);
    });

  voteReads.set(blogId, read);
  return read;
};

/** The settled answer, asking the API once per article if this tab has none. */
const settledVote = async (blogId: string) => {
  const known = voteEntries.get(blogId)?.settled;
  if (known) return known;

  const read = await readVoteStatus(blogId);
  if (read) setVoteEntry(blogId, { settled: read });

  return read;
};

/**
 * Where a burst of presses has got to.
 *
 * `desired` is what the reader wants right now: a vote type, or none. A press
 * only rewrites it while a request is out, so ten presses around one round trip
 * cost one follow-up, not ten requests.
 */
interface IVoteBurst {
  phase: "out" | "waiting";
  /** The reader's answer, as last pressed. */
  desired: TVoteType | null;
  /** The state before the burst's first press, for a rollback. */
  before: IVoteCounts;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * How long a reader is given to finish pressing before the follow-up is sent.
 * A second press inside it only rewrites `desired`, so both presses cost the
 * one request already running and, at most, a single follow-up.
 */
const SETTLE_MS = 200;

const voteBursts = new Map<string, IVoteBurst>();

const endBurst = (blogId: string) => {
  const burst = voteBursts.get(blogId);
  if (burst?.timer) clearTimeout(burst.timer);
  voteBursts.delete(blogId);
};

/**
 * Send one request for what the reader wants, then decide what follows it.
 *
 * A request that fails puts back what the burst started from and ends it: the
 * reader's own state is no longer known, so guessing again would only add
 * requests to a write that is not working.
 */ const sendVote = async (
  blogId: string,
  voteType: TVoteType,
  before: IVoteCounts,
) => {
  const burst = voteBursts.get(blogId);
  if (!burst) return;

  try {
    const body = await voteOnBlog(blogId, voteType);

    if (!body?.success) {
      // A refusal (the author's own article, a lost session) is a failed
      // write, not a saved one.
      setVoteEntry(blogId, { settled: before });
      toast.error(body?.message || "That vote was not saved.", {
        id: "vote-on-blog",
      });
      return endBurst(blogId);
    }

    const answer = shapeOf(body);
    if (!answer) {
      setVoteEntry(blogId, { settled: before });
      return endBurst(blogId);
    }

    return followUp(blogId, answer);
  } catch (error) {
    setVoteEntry(blogId, { settled: before });
    toast.error(messageOf(error) || "That vote was not saved. Try again.", {
      id: "vote-on-blog",
    });
    return endBurst(blogId);
  }
};

/**
 * After an answer: one follow-up, only if it would change anything.
 *
 * The reader's last press decides. If the server already reports that state,
 * there is nothing to send. If not, one request goes out once the reader has
 * stopped pressing for `SETTLE_MS`, and presses inside that window only
 * rewrite which one it will be.
 */
const followUp = (blogId: string, answer: IVoteCounts) => {
  const burst = voteBursts.get(blogId);
  if (!burst) return;

  if (burst.desired === answer.myVote) {
    setVoteEntry(blogId, { settled: answer });
    return endBurst(blogId);
  }

  const target = burst.desired;
  if (!target) {
    setVoteEntry(blogId, { settled: answer });
    return endBurst(blogId);
  }

  if (burst.timer) clearTimeout(burst.timer);
  burst.phase = "waiting";
  burst.timer = setTimeout(() => {
    const live = voteBursts.get(blogId);
    const settled = voteEntries.get(blogId)?.settled;
    if (!live || !settled || live.desired !== target) return;

    live.phase = "out";
    live.timer = undefined;
    live.before = settled;
    void sendVote(blogId, target, settled);
  }, SETTLE_MS);
};

/**
 * A press on one of the two vote buttons.
 *
 * The screen changes on the press, always. Whether a request leaves is a
 * separate question:
 *
 * - Nothing is out: one request goes for this press.
 * - A request is out: the press only records what the reader wants. When the
 *   request answers, `followUp` sends at most one more, and only if the
 *   server's answer still disagrees with what the reader asked for.
 *
 * The service runs a whole round trip per call, so a button cannot ask it to
 * resend a write it is already running; folding presses is what keeps a
 * rapid tapper, or a script, from becoming a stream of requests.
 */
const pressVote = (blogId: string, voteType: TVoteType) => {
  const current = voteEntries.get(blogId)?.settled;
  if (!current) return;

  // A vote is a toggle: pressing the one you hold takes it back.
  const target: TVoteType | null =
    current.myVote === voteType ? null : voteType;
  const burst = voteBursts.get(blogId);

  if (!burst) {
    // The optimistic state for the whole burst, drawn before anything leaves.
    setVoteEntry(blogId, {
      settled: current,
      pending: target ? { target, before: current } : undefined,
    });

    if (!target) return;
    voteBursts.set(blogId, { phase: "out", desired: target, before: current });
    void sendVote(blogId, target, current);
    return;
  }

  burst.desired = target;

  // Still drawn from the state before the burst, so pressing up, down, up
  // moves the counts and the pressed button with each press.
  setVoteEntry(blogId, {
    settled: burst.before,
    pending: target ? { target, before: burst.before } : undefined,
  });
};

/**
 * The state one vote control draws, for one article.
 *
 * `counts` is what the count prints and `myVote` which button is pressed,
 * both including presses that have not been answered yet. `waiting` is true
 * only while a press is waiting for the status read it needs; nothing else
 * makes the control look busy.
 */
export const useVoteState = (blogId: string, pageCounts: IVoteCounts) => {
  const [ready, setReady] = useState<{
    blogId: string;
    counts: IVoteCounts;
  } | null>(null);

  // A press that had to wait for the status read says so, so a screen reader
  // is not left pressing a control that does not answer yet.
  const [waiting, setWaiting] = useState(false);

  const entry = useSyncExternalStore(
    useCallback((notify) => subscribeToVote(blogId, notify), [blogId]),
    useCallback(() => voteEntries.get(blogId), [blogId]),
    () => undefined,
  );

  useEffect(() => {
    let live = true;

    // `ready` is keyed by article id, so a control remounted on another
    // article (a client navigation) never shows the previous one's answer.
    readVoteStatus(blogId).then((counts) => {
      if (!live || !counts) return;
      setReady({ blogId, counts });
      // A vote that started during the read knows more than this does.
      if (!voteEntries.get(blogId)?.pending) {
        setVoteEntry(blogId, { settled: counts });
      }
    });

    return () => {
      live = false;
    };
  }, [blogId]);

  const read = ready?.blogId === blogId ? ready.counts : null;

  const settled = entry?.settled ?? read ?? pageCounts;
  const counts = entry?.pending
    ? applyVote(entry.pending.before, entry.pending.target)
    : settled;

  const onVote = async (voteType: TVoteType) => {
    // A press before the status read lands waits for it rather than counting
    // on totals that describe everyone, not this reader. It is the only case
    // that does not change on the press, and it is brief.
    if (!entry?.settled && !read) {
      setWaiting(true);
      await settledVote(blogId);
      setWaiting(false);
    }

    pressVote(blogId, voteType);
  };

  return {
    counts,
    myVote: counts.myVote,
    waiting,
    onVote,
  };
};

export const useCommentOnBlog = () => {
  return useMutation<any, Error, { blogId: string; payload: FormData }>({
    mutationKey: ["COMMENT_ON_BLOG"],
    mutationFn: async ({ blogId, payload }) =>
      await commentOnBlog(blogId, payload),
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(data?.message || "Your comment was not posted.", {
          id: "comment-on-blog",
        });
      }
      if (data.success) {
        toast.success("Comment posted.", {
          id: "comment-on-blog",
        });
      }
    },
  });
};

// get all blogs (for admin only)
// Params are part of the key, so each page and filter keeps its own entry.
export const useGetAllBlogs = (params?: Record<string, string>) => {
  return useQuery({
    queryKey: params ? ["GET_ALL_BLOGS", params] : ["GET_ALL_BLOGS"],
    queryFn: async () => await getAllBlogs(params),
    placeholderData: (previous: unknown) => previous,
  });
};

export const useDeleteBlogByAdminUsingId = () => {
  return useMutation<any, Error, { blogId: string; reason: string }>({
    mutationKey: ["DELETE_BLOG_BY_ADMIN"],
    mutationFn: async ({ blogId, reason }) =>
      await deleteBlogByAdminUsingId(blogId, reason),
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(data?.message || "The article was not removed.", {
          id: "delete-blog-by-admin",
        });
      }
      if (data.success) {
        toast.success("Article removed.", {
          id: "delete-blog-by-admin",
        });
      }
    },
  });
};

export const useDeleteBlogByUserUsingId = () => {
  return useMutation<any, Error, string>({
    mutationKey: ["DELETE_BLOG_BY_USER"],
    mutationFn: async (blogId) => await deleteBlogByUserUsingId(blogId),
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(data?.message || "The article was not deleted.", {
          id: "delete-blog-by-user",
        });
      }
      if (data.success) {
        toast.success("Article deleted.", {
          id: "delete-blog-by-user",
        });
      }
    },
  });
};

export const useUpdateBlogByUserUsingId = () => {
  return useMutation<
    any,
    Error,
    { blogId: string; payload: Record<string, unknown> }
  >({
    mutationKey: ["UPDATE_BLOG_BY_USER"],
    mutationFn: async ({ blogId, payload }) =>
      await updateBlogByUserUsingId(blogId, payload),
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(data?.message || "Changes saved", {
          id: "update-blog-by-user",
        });
        return;
      }
      toast.error(data?.message || "The changes were not saved.", {
        id: "update-blog-by-user",
      });
    },
    onError: (error) => {
      toast.error(
        error.message || "The changes were not saved. Check your connection.",
        { id: "update-blog-by-user" },
      );
    },
  });
};

export const useUpdateBlogByAdmin = () => {
  return useMutation<any, Error, { blogId: string; payload: FormData }>({
    mutationKey: ["UPDATE_BLOG_BY_ADMIN"],
    mutationFn: async ({ blogId, payload }) =>
      await updateBlogByAdmin(blogId, payload),
    onSuccess: (data) => {
      if (data?.success) {
        toast.success(data?.message || "Changes saved", {
          id: "update-blog-by-admin",
        });
        return;
      }
      toast.error(data?.message || "The changes were not saved.", {
        id: "update-blog-by-admin",
      });
    },
    onError: (error) => {
      toast.error(
        error.message || "The changes were not saved. Check your connection.",
        { id: "update-blog-by-admin" },
      );
    },
  });
};

export const useDeleteCommentByUser = () => {
  return useMutation<any, Error, string>({
    mutationKey: ["DELETE_COMMENT_BY_USER"],
    mutationFn: async (commentId) => await deleteCommentByUser(commentId),
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(data?.message || "The comment was not deleted.", {
          id: "delete-comment-by-user",
        });
      }
      if (data.success) {
        toast.success("Comment deleted.", {
          id: "delete-comment-by-user",
        });
      }
    },
  });
};

export const useUpdateCommentByUser = () => {
  return useMutation<any, Error, { commentId: string; payload: FormData }>({
    mutationKey: ["UPDATE_COMMENT_BY_USER"],
    mutationFn: async ({ commentId, payload }) =>
      await updateCommentByUser(commentId, payload),
    onSuccess: (data) => {
      if (!data?.success) {
        toast.error(data?.message || "The comment was not updated.", {
          id: "update-comment-by-user",
        });
      }
      if (data.success) {
        toast.success("Comment updated.", {
          id: "update-comment-by-user",
        });
      }
    },
  });
};
