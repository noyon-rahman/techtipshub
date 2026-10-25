import { createHash, randomBytes } from "node:crypto";
import mongoose from "mongoose";

/**
 * The one-time code that lets the site receive a session the API just created.
 *
 * A Google callback is a browser redirect: the API sets the cookies on that
 * response, and they belong to the API's domain. The site is on another
 * domain, so it never sees them. Rather than putting tokens in a URL — where
 * they would sit in history, logs and Referer headers — the API puts a short
 * random code there and the site trades it, server to server, for the cookies.
 *
 * Stored hashed: a leaked database row is not a usable session. Single use: the
 * code is deleted the moment it is claimed. The TTL index means an unclaimed
 * one disappears on its own, so an abandoned sign-in leaves nothing behind.
 */
interface IHandoff {
  codeHash: string;
  accessToken: string;
  refreshToken: string;
  createdAt: Date;
}

const Handoff = mongoose.model<IHandoff>(
  "AuthHandoff",
  new mongoose.Schema<IHandoff>(
    {
      codeHash: { type: String, required: true, unique: true },
      accessToken: { type: String, required: true },
      refreshToken: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
    { versionKey: false },
  ).index({ createdAt: 1 }, { expireAfterSeconds: 60 }),
);

/** Long enough that guessing is hopeless, short enough to live in a URL. */
export const HANDOFF_TTL_SECONDS = 60;

const digest = (code: string) => createHash("sha256").update(code).digest("hex");

/** Store a session under a fresh code and return the code to put in the URL. */
export const createHandoff = async (session: {
  accessToken: string;
  refreshToken: string;
}) => {
  const code = randomBytes(32).toString("base64url");

  await Handoff.create({
    codeHash: digest(code),
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  });

  return code;
};

/**
 * Spend a code.
 *
 * `findOneAndDelete` is the whole point: two requests arriving with the same
 * code race, and only one of them gets the document. Returns `null` for a code
 * that is unknown, already used, or older than the TTL.
 */
export const claimHandoff = async (code: string) => {
  if (!code) return null;

  const found = await Handoff.findOneAndDelete({ codeHash: digest(code) }).lean();

  if (!found) return null;

  if (Date.now() - new Date(found.createdAt).getTime() > HANDOFF_TTL_SECONDS * 1000) {
    return null;
  }

  return { accessToken: found.accessToken, refreshToken: found.refreshToken };
};
