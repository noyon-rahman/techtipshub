import { model, Schema, Types } from "mongoose";

export type TSubscriptionType = "Monthly" | "Yearly";
export type TSubscriptionStatus = "Active" | "Expired" | "Cancelled";

/**
 * A membership period, as stored. TechTipsHub takes no payments today
 * (PRD.md), so nothing in the API writes these rows yet; the model exists
 * because the stored documents predate that decision and still name a member
 * and a transaction.
 */
export interface ISubscription {
  user: Types.ObjectId;
  type: TSubscriptionType;
  startDate: Date;
  endDate: Date;
  status: TSubscriptionStatus;
  price: number;
  currency: string;
  transactionId: string;
  createdAt: Date;
  updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["Monthly", "Yearly"],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["Active", "Expired", "Cancelled"],
      required: true,
    },
    price: { type: Number, required: true },
    currency: { type: String, required: true },
    transactionId: { type: String, required: true },
  },
  { timestamps: true },
);

// The account screen reads a member's periods newest first.
subscriptionSchema.index({ user: 1, startDate: -1 });

const Subscription = model<ISubscription>(
  "Subscription",
  subscriptionSchema,
  "subscriptions",
);

export default Subscription;
