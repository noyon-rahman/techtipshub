import { model, Schema } from "mongoose";
import {
  NEWSLETTER_SOURCES,
  NEWSLETTER_SUBSCRIBER_STATUSES,
  type INewsletterSubscriber,
} from "./newsletter.interface";

const subscriberSchema = new Schema<INewsletterSubscriber>(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: [60, "Name is too long"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      maxlength: [254, "Email is too long"],
    },
    emailKey: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    status: {
      type: String,
      enum: {
        values: NEWSLETTER_SUBSCRIBER_STATUSES,
        message: "{VALUE} is not a valid subscriber status",
      },
      default: "active",
    },
    source: {
      type: String,
      enum: {
        values: NEWSLETTER_SOURCES,
        message: "{VALUE} is not a valid signup source",
      },
      required: true,
    },
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    consentAt: {
      type: Date,
      required: true,
    },
    unsubscribedAt: {
      type: Date,
      default: null,
    },
    suppressedAt: {
      type: Date,
      default: null,
    },
    suppressReason: {
      type: String,
      default: null,
    },
  },
  { timestamps: true },
);

// The list screen filters by status and sorts by signup date.
subscriberSchema.index({ status: 1, createdAt: -1 });
subscriberSchema.index({ createdAt: -1 });

const NewsletterSubscriber = model<INewsletterSubscriber>(
  "NewsletterSubscriber",
  subscriberSchema,
  "newsletter_subscribers",
);

export default NewsletterSubscriber;
