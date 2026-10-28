import mongoose from "mongoose";
import config from "../config";
import AdminLog from "../modules/admin/admin-log.model";
import Payment from "../modules/billing/payment.model";
import Subscription from "../modules/billing/subscription.model";
import Blog from "../modules/blog/blog.model";
import Category from "../modules/category/category.model";
import Comment from "../modules/comment/comment.model";
import Contact from "../modules/contact/contact.model";
import Follower from "../modules/follower/follower.model";
import NewsletterCampaign from "../modules/newsletter/newsletter-campaign.model";
import NewsletterSubscriber from "../modules/newsletter/newsletter.model";
import User from "../modules/user/user.model";
import View from "../modules/view/view.model";
import Vote from "../modules/vote/vote.model";

/**
 * Bring a database to the snake_case collection names the models pin.
 *
 * Before the pin, Mongoose derived the name from the model, so renaming a
 * model moved its documents and every older one stayed behind. A collection
 * the database stored capitalised, because the deployment that first created
 * it ignored case, is also not the name a case-sensitive deployment asks for.
 *
 * So a stored collection whose name no model pins is moved into the collection
 * of the model with the same name, whatever its case; a model that was
 * released under another name lists it in `RELEASED_AS`. Mongoose creates the
 * pinned collection, which fixes the stored name exactly. Rows go over as
 * stored: no defaults, no timestamps, no validation. The old collection keeps
 * them, because dropping data is not part of a rename.
 *
 * The index build at the end is the other half: Mongoose builds a model's
 * indexes when it connects, but a collection moved here has none yet, and a
 * unique index is a constraint the app relies on. Run this before deploying a
 * model whose collection it moved.
 *
 * A collection already under its pinned name is skipped, so a run can repeat.
 *
 *   pnpm migrate:collections -- --dry
 *   pnpm migrate:collections
 */

const MODELS = [
  AdminLog,
  Payment,
  Subscription,
  User,
  Blog,
  Category,
  Comment,
  Contact,
  Follower,
  NewsletterSubscriber,
  NewsletterCampaign,
  View,
  Vote,
];

/** The stored name a model had before it pinned its own. */
const RELEASED_AS: Record<string, string[]> = {
  admin_logs: ["adminlogs"],
  newsletter_subscribers: ["newslettersubscribers"],
  newsletter_campaigns: ["newslettercampaigns"],
  posts: ["post"],
};

const dryRun = process.argv.includes("--dry");

const database = () => {
  const db = mongoose.connection.db;
  if (!db) throw new Error("The database connection is not open");
  return db;
};

/** A name that is not in use, so a run never lands on rows kept earlier. */
const freeName = (stored: Set<string>, base: string) => {
  let name = `${base}_migrated`;
  let n = 2;
  while (stored.has(name)) name = `${base}_migrated_${n++}`;
  return name;
};

const run = async () => {
  await mongoose.connect(config.DATABASE_URL);

  const stored = new Set(
    (await database().listCollections().toArray()).map(
      (collection) => collection.name,
    ),
  );
  const pinned = new Set(MODELS.map((model) => model.collection.collectionName));

  for (const model of MODELS) {
    const target = model.collection.collectionName;

    if (stored.has(target)) continue;

    const candidates = new Set(
      [
        ...(RELEASED_AS[target] ?? []),
        ...[...stored].filter(
          (name) => name.toLowerCase() === target.toLowerCase(),
        ),
      ].filter((name) => stored.has(name) && !pinned.has(name)),
    );

    if (!candidates.size) {
      process.stdout.write(`${target}: nothing stored, skipped\n`);
      continue;
    }

    for (const candidate of candidates) {
      const count = await database()
        .collection(candidate)
        .estimatedDocumentCount();
      const kept = freeName(stored, target);

      if (dryRun) {
        process.stdout.write(`${candidate} -> ${target}: would move ${count}\n`);
        continue;
      }

      await database().collection(candidate).rename(kept);

      if (!stored.has(target)) {
        await model.createCollection();
        stored.add(target);
      }

      const rows = await database().collection(kept).find({}).toArray();
      for (const row of rows) {
        await model.collection.replaceOne({ _id: row._id }, row, {
          upsert: true,
        });
      }

      stored.delete(candidate);
      stored.add(kept);

      process.stdout.write(
        `${candidate} -> ${target}: moved ${rows.length}, old rows kept as ${kept}\n`,
      );
    }
  }

  if (dryRun) {
    process.stdout.write("\nWould build the indexes of every model.\n");
    await mongoose.disconnect();
    return;
  }

  for (const model of MODELS) {
    await model.createIndexes();
  }
  process.stdout.write("indexes built for every model\n");

  for (const name of stored) {
    if (pinned.has(name) || !name.includes("_migrated")) continue;

    process.stdout.write(`${name}: rows kept here, safe to drop once checked\n`);
  }

  await mongoose.disconnect();
};

run().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
