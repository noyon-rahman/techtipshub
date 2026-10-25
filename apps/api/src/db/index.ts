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
 * Vercel the connect is started when the module loads and the request arrives
 * alongside it, so buffering is what keeps the two from racing. Stated
 * explicitly because a project that turned it off would fail those queries.
 */
const connectToDatabase = async () => {
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
  }
};

export default connectToDatabase;
