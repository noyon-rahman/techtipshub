/**
 * The shapes the API sends over the wire.
 *
 * These are serialised JSON, so every date is a string and every id is a
 * string. The matching database interfaces stay in `apps/api` because they
 * carry `Document`, `ObjectId` and `Date`, which a browser can neither use nor
 * receive.
 */

import type { TContentType, TSocialLink, TUserGender, TUserRole, TUserStatus } from "./enums";

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
  createdAt: string;
  updatedAt: string;
  __v: number;
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
