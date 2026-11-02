/**
 * Test support for `username-onboarding.mjs`: age a throwaway account's lock.
 *
 *   tsx --env-file=../../apps/api/.env.development ./scripts/test/age-username-lock.ts <email> <days>
 *
 * The 30 day lock is real time, so the only way to check what happens after it
 * without waiting is to move the date the lock is counted from. This touches
 * one account, named by the caller, and only the field the rule reads.
 */
import mongoose from "mongoose";
import { addDays } from "date-fns";
import config from "../../apps/api/src/config/env";
import User from "../../apps/api/src/modules/user/user.model";

const [email, days] = process.argv.slice(2);

if (!email || !days) {
  process.stderr.write("usage: <email> <days>\n");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(config.DATABASE_URL);

  const changedAt = addDays(new Date(), -Math.abs(Number(days)));
  const result = await User.collection.updateOne(
    { email },
    { $set: { usernameChangedAt: changedAt } },
  );

  process.stdout.write(
    `${email}: ${result.modifiedCount} row aged to ${changedAt.toISOString()}\n`,
  );
  await mongoose.disconnect();
};

run().catch(async (error) => {
  process.stderr.write(`${error?.message}\n`);
  await mongoose.disconnect();
  process.exit(1);
});
