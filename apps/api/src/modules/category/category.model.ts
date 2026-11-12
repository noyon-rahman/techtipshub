import { Schema, model } from "mongoose";
import { ICategory } from "./category.interface";

const categorySchema = new Schema<ICategory>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    // Stored as `postCount` for database compatibility; exposed as `blogCount`.
    postCount: {
      type: Number,
      default: 0,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  {
    timestamps: true,
    // Without this the virtual below never reaches the JSON, and every caller
    // that reads `blogCount` sees `undefined` from a category that has articles.
    toJSON: {
      virtuals: true,
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.isDeleted;
        return ret;
      },
    },
    toObject: { virtuals: true },
  },
);

// The field is stored as `postCount` so existing documents keep working, but
// the API speaks `blogCount` and the client reads that name.
categorySchema.virtual("blogCount").get(function () {
  return this.postCount;
});

categorySchema.pre("find", function (next) {
  // The trash list is the one caller that has to see removed rows.
  if (!this.getOptions()?.bypassMiddleware) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

categorySchema.pre("findOne", function (next) {
  if (!this.getOptions()?.bypassMiddleware) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

const Category = model<ICategory>("Category", categorySchema, "categories");

export default Category;
