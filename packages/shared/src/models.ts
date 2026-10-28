/**
 * The shapes the API sends over the wire.
 *
 * These are serialised JSON, so every date is a string and every id is a
 * string. The matching database interfaces stay in `apps/api` because they
 * carry `Document`, `ObjectId` and `Date`, which a browser can neither use nor
 * receive.
 */

import type {
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
  isDeleted: boolean;
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
  isDeleted: boolean;
  socialLinks: TSocialLink[];
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
  isDeleted: boolean;
  /**
   * Whether readers can see it. A draft is only open to its author and the
   * admins. Rows stored before drafts existed have no value and are published.
   */
  status?: "draft" | "published";
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

export interface IComment {
  _id: string;
  /** The API names the commented article `post`. */
  post: ICommentBlog;
  user: ICommentUser;
  content: string;
  isDeleted: boolean;
  images: string[];
  upVotes: number;
  downVotes: number;
  createdAt: string;
  updatedAt: string;
}
