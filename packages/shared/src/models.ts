/**
 * The shapes the API sends over the wire.
 *
 * These are serialised JSON, so every date is a string and every id is a
 * string. The matching database interfaces stay in `apps/api` because they
 * carry `Document`, `ObjectId` and `Date`, which a browser can neither use nor
 * receive.
 */

import type {
  TArticleAccess,
  TContentType,
  TSocialLink,
  TUserGender,
  TUserRole,
  TUserStatus,
} from "./enums";

export interface ICategory {
  _id: string;
  name: string;
  description: string;
  blogCount: number;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface IUser {
  _id: string;
  fullName: string;
  username: string;
  bio: string;
  designation: string;
  email: string;
  phone: string;
  location: string;
  profilePicture: string;
  gender: TUserGender;
  role: TUserRole;
  status: TUserStatus;
  totalFollowers: number;
  totalFollowing: number;
  dateOfBirth: string;
  isVerified: boolean;
  socialLinks: TSocialLink[];
  /**
   * The categories the reader asked to see. Category ids, stored as strings.
   * Absent on every account created before interests existed, which reads as
   * "none chosen".
   */
  interests?: string[];
  /** Whether the reader has answered the interests step, with a choice or a skip. */
  interestsAnsweredAt?: string;
  /** When the member confirmed their handle at the step after a first sign-in. */
  usernameOnboardedAt?: string;
  /** When the current handle was chosen. Absent means it has never changed. */
  usernameChangedAt?: string;
  /** The oldest handle still reserved, and when it frees up. Kept private. */
  usernameHistory?: IUsernameHistoryEntry[];
  createdAt: string;
  updatedAt: string;
  totalBlogs: number;
  __v: number;
}

/**
 * The article as sent to a reader.
 *
 * `content` is absent for guests: the API answers with a preview and sets
 * `isLocked`, so callers check the flag rather than an empty string.
 */
export interface IBlog {
  _id: string;
  author: IUser;
  title: string;
  slug: string;
  contentType: TContentType;
  content: string;
  isLocked?: boolean;
  coverImage: string;
  category: ICategory;
  images: string[];
  tags: string[];
  upVotes: number;
  downVotes: number;
  totalComments: number;
  totalViews: number;
  /**
   * Whether readers can see it. A draft is only open to its author and the
   * admins. Rows stored before drafts existed have no value and are published.
   */
  status?: "draft" | "published";
  /**
   * Who may read the body once it is published. Rows stored before this field
   * existed carry no value and are members only, which is how they behaved.
   */
  access?: TArticleAccess;
  /** When it first went live. Absent while it is a draft. */
  publishedAt?: string;
  /** The admin who created it on the author's behalf, when that was someone else. */
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export type TVoteType = "upvote" | "downvote";

/**
 * What `PUT /blogs/:id/vote` answers, and what `GET /blogs/:id/vote-status`
 * describes, once the request has committed.
 *
 * `myVote` is the signed-in reader's vote afterwards: `null` when the same
 * button was pressed again and the vote was taken back. A page that voted
 * optimistically compares against this instead of assuming its guess was right.
 */
export interface IVoteResult {
  blogId: string;
  upVotes: number;
  downVotes: number;
  myVote: TVoteType | null;
}

/**
 * Whether the signed-in reader follows a member, and that member's follower
 * count afterwards.
 *
 * `GET /users/:id/follow-status`, `PUT /users/:id/follow` and
 * `DELETE /users/:id/unfollow` all answer with this, so the button can settle
 * on the server's answer instead of trusting its optimistic count.
 */
export interface IFollowResult {
  userId: string;
  isFollowing: boolean;
  totalFollowers: number;
}

export interface ICommentBlog {
  _id: string;
  title: string;
  slug: string;
}

export interface ICommentUser {
  _id: string;
  fullName: string;
  username: string;
  email: string;
  profilePicture: string;
}

/**
 * What the reader has told the feed, and what the feed can say about it.
 *
 * `names` are the saved interests resolved to category names, in the order the
 * reader picked them, so a screen never has to look them up itself. A category
 * that was removed since it was picked is left out of `names` but stays in
 * `interests`, so nothing is rewritten behind the reader's back.
 */
export interface IReaderInterests {
  interests: string[];
  names: string[];
  answered: boolean;
}

/**
 * Where a feed page's order came from. `personalized` means at least one
 * interest matched the page; `following` means every article on it is by a
 * writer the reader follows; anything else is the engagement order every reader
 * gets, so a page never claims an order it did not have.
 */
export type TFeedReason = "personalized" | "following" | "engagement";

/**
 * A handle this member used to hold, and when it becomes claimable again.
 *
 * The old handle answers a redirect to the current one until `reservedUntil`,
 * and is refused to everyone until then, so nobody can inherit the links the
 * member's articles earned.
 */
export interface IUsernameHistoryEntry {
  username: string;
  reservedUntil: string;
}

/**
 * The handle rules, as the member is subject to them right now.
 *
 * `lockedUntil` is `null` once a change is allowed. The dates are ISO strings
 * because this crosses the wire; every screen formats them the same way
 * (`formatUsernameDate` in the shared helpers).
 */
export interface IUsernameChangeState {
  username: string;
  lockedUntil: string | null;
  /** Whether a change right now would be this member's first one. */
  canChange: boolean;
}

/**
 * What `username/availability` answers while a handle is typed.
 *
 * `reason` is the sentence to show when `available` is false, already worded as
 * the API would word it, so the form does not write a second copy.
 */
export interface IUsernameAvailability {
  username: string;
  available: boolean;
  reason: string | null;
}

/**
 * What the username step asks for on load: the handle to offer, and whether the
 * step still has anything to ask.
 */
export interface IUsernameOnboardingState {
  currentUsername: string;
  suggestedUsername: string;
  onboarded: boolean;
}

export interface IComment {
  _id: string;
  /** The API names the commented article `post`. */
  post: ICommentBlog;
  user: ICommentUser;
  content: string;
  images: string[];
  upVotes: number;
  downVotes: number;
  createdAt: string;
  updatedAt: string;
}
