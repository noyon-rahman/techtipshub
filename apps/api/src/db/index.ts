import mongoose from "mongoose";
import config from "../config";

/**
 * Connections kept per process. A server holds one; a hosted function may hold
 * one per warm instance, and Fluid compute keeps few.
 */
const poolSize = process.env.VERCEL ? 3 : undefined;

/**
 * Mongoose buffers a query made before the connection exists and replays it
 * once connected. A server needs that only for the first few milliseconds; on
 * Vercel the connect is started before a request runs, so buffering is what
 * keeps the two from racing. Stated explicitly because a project that turned
 * it off would fail those queries.
 */
const connect = async () => {
  mongoose.set("bufferCommands", true);

  try {
    await mongoose.connect(config.DATABASE_URL, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: poolSize,
    });
    // eslint-disable-next-line no-console
    console.log("Connected to database");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to connect to the database", err);

    // Under Vercel the process is shared by every request the instance serves,
    // and exiting here takes them all down with a bare
    // FUNCTION_INVOCATION_FAILED. The queries that need the database fail on
    // their own and reach the error handler, which is where the reason shows.
    if (!process.env.VERCEL) process.exit(1);

    throw err;
  }
};

/**
 * One connection attempt per process. A failed attempt is not kept, so the next
 * request asks again: an instance whose cold start met a network or database
 * outage recovers on its own instead of staying broken until it is recycled.
 */
let connecting: Promise<void> | undefined;

const connectToDatabase = () => {
  if (!connecting) {
    connecting = connect().catch((error) => {
      connecting = undefined;
      throw error;
    });
  }

  return connecting;
};

export default connectToDatabase;
