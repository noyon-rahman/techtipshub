import { model, Schema } from "mongoose";
import { IUsernameHistoryEntry } from "./user.interface";

/**
 * Every handle a member stopped using, kept so its old address keeps working.
 *
 * A rename breaks every link to the profile that was shared before it, and the
 * articles under that address carried whatever ranking they had earned. Two
 * things keep that value: the old address answers a permanent redirect to the
 * new one, and nobody else may claim the old handle while it does, or the
 * redirect would quietly start pointing at a stranger.
 */
const usernameHistorySchema = new Schema<IUsernameHistoryEntry>(
  {
    username: {
      type: String,
      required: true,
    },
    userId: {
      type: String,
      required: true,
    },
    reservedUntil: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true },
);

// One row per handle: a member who goes back to an old name does not get a
// second row for it, so the check for "is this taken" stays a single lookup.
usernameHistorySchema.index({ username: 1 }, { unique: true });
// Cleanup reads by expiry; a redirect lookup reads by handle above.
usernameHistorySchema.index({ reservedUntil: 1 });

const UsernameHistory = model<IUsernameHistoryEntry>(
  "UsernameHistory",
  usernameHistorySchema,
  "username_history",
);

export default UsernameHistory;
