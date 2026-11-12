import { model, Schema } from "mongoose";
import { IComment } from "./comment.interface";

const commentSchema = new Schema<IComment>(
  {
    // Stored as `post` for database compatibility; it references a blog.
    post: {
      type: Schema.ObjectId,
      ref: "Post",
      required: [true, "Blog reference is required"],
    },
    user: {
      type: Schema.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    content: {
      type: String,
      required: [true, "Comment content is required"],
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
    images: [
      {
        type: String,
      },
    ],
    upVotes: {
      type: Number,
      default: 0,
    },
    downVotes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.isDeleted;
        return ret;
      },
    },
  },
);

commentSchema.pre("find", function (next) {
  // The trash list is the one caller that has to see removed rows.
  if (!this.getOptions()?.bypassMiddleware) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

commentSchema.pre("findOne", function (next) {
  if (!this.getOptions()?.bypassMiddleware) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

const Comment = model<IComment>("Comment", commentSchema, "comments");

export default Comment;
