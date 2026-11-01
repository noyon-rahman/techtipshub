import { model, Schema } from "mongoose";
import { BlogAccess, BlogContentType, BlogStatus } from "./blog.constant";
import { IBlog } from "./blog.interface";

const blogSchema = new Schema<IBlog>(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Author Id is require"],
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    slug: {
      type: String,
      required: [true, "Slug is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    contentType: {
      type: String,
      enum: {
        values: BlogContentType,
        message: "{VALUE} is not a valid content type",
      },
      required: [true, "Content type is required"],
    },
    content: {
      type: String,
      required: [true, "Content is required"],
    },
    coverImage: {
      type: String,
      required: [true, "Image is required"],
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category Id is required"],
    },
    images: {
      type: [String],
      default: [],
    },
    tags: {
      type: [String],
      required: [true, "Tags are required"],
      default: [],
    },
    // One place decides whether a piece is readable: `status`. `isDeleted`
    // says it was removed. Rows written before drafts existed have no value
    // stored, and every reader of this field treats a missing one as
    // published, which is what they are.
    status: {
      type: String,
      enum: {
        values: BlogStatus,
        message: "{VALUE} is not a valid status",
      },
      default: "published",
    },
    // The admin who created this on the author's behalf. Empty when the author
    // wrote it themselves.
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    // Who may read it once published. Rows written before this was a choice
    // have no value, and every reader treats a missing one as members only,
    // which is how those rows behaved.
    access: {
      type: String,
      enum: {
        values: BlogAccess,
        message: "{VALUE} is not a valid access setting",
      },
      default: "members",
    },
    // When it first went live. Absent while it is a draft.
    publishedAt: {
      type: Date,
    },
    upVotes: {
      type: Number,
      default: 0,
    },
    downVotes: {
      type: Number,
      default: 0,
    },
    totalComments: {
      type: Number,
      default: 0,
    },
    totalViews: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Trashed articles are hidden from every query unless the call says it is
// looking at them, which only the trash view and the restore path do.
// `setOptions({ bypassMiddleware: true })` is that permission, the same one
// the member model uses.
//
// Drafts are hidden from the same queries, because everything that reads this
// model without saying otherwise is a reader-facing screen. A query that means
// "whatever state it is in" (the trash, the admin editor, a published check)
// passes `includeDrafts: true` or writes its own filter.
blogSchema.pre("find", function (next) {
  if (!this.getOptions()?.bypassMiddleware) {
    this.find({ isDeleted: { $ne: true } });
  }
  if (!this.getOptions()?.includeDrafts) {
    this.find({ status: { $ne: "draft" } });
  }
  next();
});

blogSchema.pre("findOne", function (next) {
  if (!this.getOptions()?.bypassMiddleware) {
    this.find({ isDeleted: { $ne: true } });
  }
  if (!this.getOptions()?.includeDrafts) {
    this.find({ status: { $ne: "draft" } });
  }
  next();
});

// The model is named "Post" so every `ref: "Post"` resolves; the collection is
// pinned because a name Mongoose would derive is a second scheme to keep in
// step with the migration script.
const Blog = model<IBlog>("Post", blogSchema, "posts");

export default Blog;
