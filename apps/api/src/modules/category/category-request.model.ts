import { model, Schema, Types } from "mongoose";

/**
 * A member's ask for a category that does not exist yet. It is not a category:
 * an admin answers it, and only an approval creates the live one.
 */
export type TCategoryRequestStatus = "pending" | "approved" | "declined";

export const CATEGORY_REQUEST_STATUSES: TCategoryRequestStatus[] = [
  "pending",
  "approved",
  "declined",
];

export interface ICategoryRequest {
  name: string;
  /** Lowercased name, so one index answers both "is this a duplicate" and search. */
  nameKey: string;
  description: string;
  status: TCategoryRequestStatus;
  requestedBy: Types.ObjectId;
  requestedByEmail: string;
  reviewedBy?: Types.ObjectId | null;
  reviewedByEmail?: string;
  reviewedAt?: Date | null;
  /** The live category, set when the request was approved. */
  category?: Types.ObjectId | null;
  declineReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const categoryRequestSchema = new Schema<ICategoryRequest>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [60, "Name is too long"],
    },
    nameKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    // Every state is readable here: there is no draft or trash to hide, so the
    // model carries no find hook and a pending row is never filtered out.
    status: {
      type: String,
      enum: {
        values: CATEGORY_REQUEST_STATUSES,
        message: "{VALUE} is not a valid status",
      },
      default: "pending",
      index: true,
    },
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    requestedByEmail: {
      type: String,
      trim: true,
      lowercase: true,
      required: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    reviewedByEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },
    declineReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

categoryRequestSchema.index({ status: 1, createdAt: -1 });
categoryRequestSchema.index({ requestedByEmail: 1, status: 1 });

const CategoryRequest = model<ICategoryRequest>(
  "CategoryRequest",
  categoryRequestSchema,
  "category_requests",
);

export default CategoryRequest;
