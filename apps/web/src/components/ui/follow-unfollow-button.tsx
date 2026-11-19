"use client";

import { useUser } from "@/context/user.provider";
import {
  readFollowEntry,
  readFollowStatus,
  setFollowEntry,
  subscribeToFollow,
  useFollowUser,
  useUnfollowUser,
  type IFollowState,
} from "@/hooks/user.hook";
import { messageOf } from "@/lib/api-error";
import { Button } from "@heroui/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { GoPlus } from "react-icons/go";
import { HiMinus } from "react-icons/hi2";
import { toast } from "@/lib/toast";
import { AuthenticationModal } from "../modals";

interface IProps {
  id: string;
  /** How the control reads in a list row, where the member's name is beside it. */
  label?: string;
}

/**
 * How long to wait for the reader to stop pressing before sending the one
 * follow-up a burst is allowed. Long enough that a double tap is one request,
 * short enough that a deliberate second press still feels immediate.
 */
const SETTLE_MS = 200;

/** What a press on this member is asking for, while a request is out. */
interface IBurst {
  /** The state the burst started from, for a rollback and for the count. */
  before: IFollowState;
  /** The reader's latest answer: follow, or do not. */
  desired: boolean;
  /** A request is out. Further presses only rewrite `desired`. */
  out: boolean;
  /** A follow-up is waiting for the reader to stop pressing. */
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * Follow or unfollow one member, optimistically.
 *
 * The button and its count move on the press, and nothing spins while the
 * request is out: the reader is looking at the result already. The API's
 * answer then replaces the guess, because its follower count includes people
 * this tab never saw. A failure puts back what the press found, and says so
 * once.
 *
 * Rapid presses never fan out into one request each. At most one request is in
 * flight for this member; presses that land while it is out only record what
 * the reader wants. When the answer arrives that is compared with the server:
 * agree, and the burst ends; disagree, and one request for a single follow-up
 * goes out after the reader stops. A hammering script costs two requests.
 */
const FollowUnFollowButton: React.FC<IProps> = ({ id, label }) => {
  const { user: loggedInUser } = useUser();
  const follow = useFollowUser();
  const unfollow = useUnfollowUser();

  const isOwnProfile = Boolean(loggedInUser && loggedInUser._id === id);
  const isAdmin = loggedInUser?.role === "Admin";

  const settled = useSyncExternalStore(
    useCallback((notify) => subscribeToFollow(id, notify), [id]),
    useCallback(() => readFollowEntry(id), [id]),
    () => undefined,
  );

  // The entry is the tab's answer for this member; when two controls show the
  // same member, the one that mounts first does the one read.
  useEffect(() => {
    let live = true;

    if (!settled) {
      readFollowStatus(id).then((status) => {
        if (!live || !status || readFollowEntry(id)) return;
        setFollowEntry(id, status);
      });
    }

    return () => {
      live = false;
    };
  }, [id, settled]);

  const isFollowing = settled?.isFollowing ?? false;

  // The burst lives in a ref, not state: it is read when an answer arrives and
  // is never drawn. The entry is what the screen shows.
  const burst = useRef<IBurst | null>(null);
  // Set only while a press is waiting for the status read it needs. The one
  // case where the button does not move on the press, so a screen reader is
  // told.
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    return () => {
      if (burst.current?.timer) clearTimeout(burst.current.timer);
    };
  }, []);

  const endBurst = () => {
    if (burst.current?.timer) clearTimeout(burst.current.timer);
    burst.current = null;
  };

  const send = (current: IBurst) => {
    // Marked out on the shared ref, so a press made while the answer is in
    // flight sees it. Replaced, not written into: `current` is the value the
    // burst held before this request.
    burst.current = { ...current, out: true };

    const target = current.desired;
    const write = target ? follow : unfollow;

    write.mutate(
      { memberId: id, before: current.before },
      {
        onSuccess: (data) => {
          const live = burst.current;
          if (!live) return;

          if (!data?.success) {
            setFollowEntry(id, live.before);
            toast.error(data?.message || "That change was not saved.", {
              id: "follow-user",
            });
            return endBurst();
          }

          // The server's count wins: it includes followers this tab never saw.
          const answer: IFollowState = data.data
            ? {
                isFollowing: data.data.isFollowing,
                totalFollowers: data.data.totalFollowers,
              }
            : {
                isFollowing: target,
                totalFollowers: live.before.totalFollowers,
              };

          // A press during the request knows better than this answer does.
          if (live.desired === answer.isFollowing) {
            setFollowEntry(id, answer);
            return endBurst();
          }

          // One follow-up, for wherever the reader ended up.
          const desired = live.desired;
          if (live.timer) clearTimeout(live.timer);

          const settled: IBurst = {
            ...live,
            desired,
            before: answer,
            out: false,
            timer: setTimeout(() => {
              const next = burst.current;
              if (!next || next.desired !== desired) return;

              burst.current = { ...next, timer: undefined, before: answer };
              send(next);
            }, SETTLE_MS),
          };
          burst.current = settled;
        },
        onError: (error) => {
          const live = burst.current;
          setFollowEntry(
            id,
            live?.before ?? { isFollowing, totalFollowers: 0 },
          );
          toast.error(
            messageOf(error) || "That change was not saved. Try again.",
            { id: "follow-user" },
          );
          endBurst();
        },
      },
    );
  };

  const toggle = async () => {
    // A press before the status read has landed cannot show the right state
    // between press and answer, so it waits for that read.
    let before = settled;
    if (!before) {
      setWaiting(true);
      before = await readFollowStatus(id);
      setWaiting(false);

      if (!before) {
        toast.error("That did not load. Try again.", { id: "follow-user" });
        return;
      }
    }

    const current = burst.current;
    // A new object each press rather than a write into the ref's value: the
    // burst is what the next answer reads, so it is replaced whole.
    const next: IBurst = current
      ? { ...current, desired: !current.desired }
      : { before, desired: !before.isFollowing, out: false };
    burst.current = next;

    const wasFollowing = before.isFollowing;
    const following = next.desired;
    setFollowEntry(id, {
      isFollowing: following,
      totalFollowers: Math.max(
        0,
        before.totalFollowers +
          (following === wasFollowing ? 0 : following ? 1 : -1),
      ),
    });

    // A request is out, or a follow-up is already waiting. The press only
    // rewrote what the burst wants; the answer decides what is sent next.
    if (next.out || next.timer) return;

    send(next);
  };

  // Readers who are looking at their own profile have nothing to follow, so
  // the control is not shipped at all rather than shown permanently disabled.
  if (isOwnProfile) return null;

  // In a list the name is already on the row, so the accessible name says who
  // the button is about without the reader having to look back at the heading.
  const who = label ?? "this member";

  // The API only lets a member follow, and the button says so up front.
  const buttonClassName =
    "w-full border border-default-300 text-foreground hover:bg-default-100";

  if (!loggedInUser) {
    return (
      <AuthenticationModal
        buttonContent="Follow"
        size="sm"
        radius="lg"
        variant="bordered"
        startContent={<GoPlus aria-hidden className="text-lg" />}
        className={buttonClassName}
        aria-label={`Follow ${who}`}
      />
    );
  }

  return (
    <Button
      onPress={toggle}
      isDisabled={isAdmin}
      size="sm"
      radius="lg"
      variant="bordered"
      className={buttonClassName}
      startContent={
        isFollowing ? (
          <HiMinus aria-hidden className="text-lg" />
        ) : (
          <GoPlus aria-hidden className="text-lg" />
        )
      }
      aria-pressed={isFollowing}
      aria-busy={waiting || undefined}
      aria-label={
        settled
          ? isFollowing
            ? `Unfollow ${who}, ${settled.totalFollowers.toLocaleString()} followers`
            : `Follow ${who}, ${settled.totalFollowers.toLocaleString()} followers`
          : undefined
      }
    >
      {isFollowing ? "Unfollow" : "Follow"}
    </Button>
  );
};

export default FollowUnFollowButton;
