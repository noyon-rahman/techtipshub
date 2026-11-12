import mongoose from "mongoose";
import config from "../config";
import User from "../modules/user/user.model";

/**
 * Remove the retired `isPremiumUser` field from all stored user documents.
 *
 * Uses `User.collection` directly so soft-deleted accounts are cleaned up too.
 *
 *   pnpm --filter @techtipshub/api migrate:remove-is-premium-user -- --dry
 *   pnpm --filter @techtipshub/api migrate:remove-is-premium-user
 */

const dryRun = process.argv.includes("--dry");

const run = async () => {
  await mongoose.connect(config.DATABASE_URL);

  const filter = { isPremiumUser: { $exists: true } };
  const pending = await User.collection.countDocuments(filter);

  if (dryRun) {
    process.stdout.write(
      `${pending}: user document(s) still carry isPremiumUser. Nothing has changed.\n`,
    );
    await mongoose.disconnect();
    return;
  }

  const result = await User.collection.updateMany(filter, {
    $unset: { isPremiumUser: "" },
  });

  process.stdout.write(
    `${result.modifiedCount}: removed isPremiumUser from user document(s)\n`,
  );

  await mongoose.disconnect();
};

run().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});

