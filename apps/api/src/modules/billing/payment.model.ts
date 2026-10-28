import { model, Schema, Types } from "mongoose";

export type TPaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";

/**
 * One charge against a membership period, as stored. No route writes these
 * rows: the site takes no payments (PRD.md). Kept so a stored receipt still
 * names the member and the period it paid for.
 */
export interface IPayment {
  transactionId: string;
  user: Types.ObjectId;
  subscription: Types.ObjectId;
  paymentMethod: string;
  amount: number;
  currency: string;
  status: TPaymentStatus;
  paidAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    transactionId: { type: String, required: true, unique: true },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    subscription: {
      type: Schema.Types.ObjectId,
      ref: "Subscription",
      required: true,
    },
    paymentMethod: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending", "Paid", "Failed", "Refunded"],
      required: true,
    },
    paidAt: { type: Date, default: null },
  },
  { timestamps: true },
);

const Payment = model<IPayment>("Payment", paymentSchema, "payments");

export default Payment;
