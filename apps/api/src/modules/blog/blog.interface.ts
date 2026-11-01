import { Document, Types } from "mongoose";

export type TContentType = "html" | "markdown" | "text";

/** Writing that only its author and the admins can open, or one readers see. */
export type TBlogStatus = "draft" | "published";

/**
 * Who may read a published article: anyone, or members with a session. Absent
 * on rows written before this was a choice; those are read as members.
 */
export type TArticleAccess = "members" | "public";

export interface IBlog extends Document {
  author: Types.ObjectId;
  /** The admin who wrote it on someone's behalf, when that is not the author. */
  createdBy?: Types.ObjectId;
  title: string;
  slug: string;
  contentType: TContentType;
  content: string;
  coverImage: string;
  images: string[];
  category: Types.ObjectId;
  tags: string[];
  status: TBlogStatus;
  access?: TArticleAccess;
  publishedAt?: Date;
  upVotes: number;
  downVotes: number;
  totalViews: number;
  totalComments: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}
