import mongoose from "mongoose";
import config from "../config";
import User from "../modules/user/user.model";
import UsernameHistory from "../modules/user/username-history.model";

/**
 * Mark every account that existed before the username step as having met it.
 *
 * The step exists to let a new member choose the handle they will live with.
 * A member who joined before it does not get a surprise prompt on their next
 * sign-in: they keep the handle they chose, are treated as having confirmed it,
 * and can still change it once from their profile under the usual lock.
 *
 * Rows already marked are skipped, so a run can repeat. The history collection
 * is created too, so its unique index exists before the first rename needs it.
 *
 *   pnpm migrate:username-onboarding -- --dry
 *   pnpm migrate:username-onboarding
 */

const dryRun = process.argv.includes("--dry");

const run = async () => {
  await mongoose.connect(config.DATABASE_URL);

  const pending = await User.countDocuments({
    usernameOnboardedAt: { $exists: false },
  });

  if (dryRun) {
    process.stdout.write(
      `${pending}: would be marked as onboarded. Nothing has changed.\n`,
    );
    await mongoose.disconnect();
    return;
  }

  // `updateMany` on the model's collection skips the find hooks and the save
  // hook on purpose: this writes one date and touches nothing else, and it has
  // to reach soft-deleted members too, since restoring one must not send it to
  // the step either.
  const now = new Date();
  const result = await User.collection.updateMany(
    { usernameOnboardedAt: { $exists: false } },
    { $set: { usernameOnboardedAt: now } },
  );

  await UsernameHistory.createIndexes();

  process.stdout.write(
    `${result.modifiedCount}: marked as onboarded on ${now.toISOString()}\n`,
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
