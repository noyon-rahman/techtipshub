import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
import mongoose, { FilterQuery } from "mongoose";
import {
  buildSearchFilter,
  QueryBuilder,
  type TQueryBuilderOptions,
} from "../../builder";
import { USER_ROLE, USER_STATUS } from "../../constant";
import config from "../../config/env";
import { durationLabel, verifyEmailMessage } from "../../emails";
import { AppError } from "../../errors";
import { isEmailConfigured, sendEmail } from "../../utils";
import { adminLogService } from "../admin/admin-log.service";
import Category from "../category/category.model";
import Comment from "../comment/comment.model";
import Follower from "../follower/follower.model";
import Blog from "../blog/blog.model";
import View from "../view/view.model";
import Vote from "../vote/vote.model";
import {
  isReservedUsername,
  normaliseUsername,
  suggestUsername,
  usernameProblem,
  usernameWithSuffix,
} from "@techtipshub/shared";
import { IUser, TSocialLink } from "./user.interface";
import User from "./user.model";
import UsernameHistory from "./username-history.model";
import {
  USERNAME_CHANGE_LOCK_DAYS,
  formatUsernameDate,
  isUsernameChange,
  usernameLockEndsAt,
  usernameReservationEndsAt,
} from "./username.rules";

// Values the admin panel may filter/sort members by. Anything else is a 400.
const USER_SORT_FIELDS = [
  "createdAt",
  "updatedAt",
  "fullName",
  "username",
  "email",
  "role",
  "status",
  "totalPosts",
] as const;

/** `page`/`limit` as numbers, clamped to sane bounds (page >= 1, 1..100). */
const pageParams = (rawQuery: Record<string, unknown>) => {
  const page = Math.max(1, Math.trunc(Number(rawQuery.page)) || 1);
  const rawLimit = Math.trunc(Number(rawQuery.limit));
  const limit = rawLimit > 0 ? Math.min(100, rawLimit) : 10;

  return { page, limit };
};

/** Validate `page`, `limit` and `sort` for the admin member lists. */
const parseListQuery = (
  rawQuery: Record<string, unknown>,
  { defaultSort, maxLimit }: { defaultSort: string; maxLimit: number },
) => {
  const parsed: Record<string, unknown> = {};

  if (typeof rawQuery.page === "string" && rawQuery.page)
    parsed.page = rawQuery.page;
  if (typeof rawQuery.limit === "string" && rawQuery.limit)
    parsed.limit = rawQuery.limit;
  if (typeof rawQuery.fields === "string" && rawQuery.fields)
    parsed.fields = rawQuery.fields;

  const sort = typeof rawQuery.sort === "string" ? rawQuery.sort.trim() : "";
  if (sort) {
    const fields = sort.split(",").map((part) => part.trim());
    const allowed = new Set<string>([...USER_SORT_FIELDS, "_id"]);

    for (const field of fields) {
      const name = field.replace(/^[-+]/, "");
      if (!allowed.has(name)) {
        throw new AppError(
          httpStatus.BAD_REQUEST,
          `Invalid sort field "${name}". Allowed: ${USER_SORT_FIELDS.join(", ")}`,
        );
      }
    }

    parsed.sort = fields.join(",");
  } else {
    parsed.sort = defaultSort;
  }

  // Cap the page size like the other admin lists, so one request cannot pull
  // the whole member collection.
  const limit = Number(parsed.limit);
  if (Number.isFinite(limit) && limit > maxLimit)
    parsed.limit = String(maxLimit);

  return parsed;
};

const parseEnumParam = (
  raw: unknown,
  allowed: readonly string[],
  label: string,
  { allowAll = false }: { allowAll?: boolean } = {},
) => {
  if (raw === undefined || raw === "") return undefined;

  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (allowAll && value === "all") return undefined;

  const match = allowed.find((option) => option.toLowerCase() === value);

  if (!match) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      `${label} must be one of ${allowAll ? ["all", ...allowed].join(", ") : allowed.join(", ")}`,
    );
  }

  return match;
};

const USER_ROLE_VALUES = [USER_ROLE.ADMIN, USER_ROLE.USER] as const;
const USER_STATUS_VALUES = [USER_STATUS.ACTIVE, USER_STATUS.BLOCKED] as const;

/**
 * `status` is checked against USER_STATUS_VALUES by `parseEnumParam` before the
 * builder sees it, so this list keeps it; `QueryBuilder.filter()` strips it for
 * every list that has not done the same. `isDeleted` stays stripped: trashed
 * members have their own endpoint.
 */
const MEMBER_LIST_OPTIONS: TQueryBuilderOptions = {
  allowVisibilityFilters: ["status"],
};

const getAllUsers = async (query: Record<string, unknown>) => {
  // Whitelisted keys only: QueryBuilder.filter() splices the query object into
  // the Mongo filter, so unvetted keys could carry operators.
  const parsed = parseListQuery(query, {
    defaultSort: "-createdAt,-_id",
    maxLimit: 100,
  });

  // Header status/role tabs, e.g. `?status=Blocked` / `?role=Admin`. "all" is
  // the panel's way of saying "no filter", so it is accepted and ignored, and
  // case is normalised: `?role=admin` would otherwise reach Mongo with the
  // wrong case through filter() and return an empty page.
  const status = parseEnumParam(query.status, USER_STATUS_VALUES, "Status", {
    allowAll: true,
  });
  if (status) parsed.status = status;

  const role = parseEnumParam(query.role, USER_ROLE_VALUES, "Role", {
    allowAll: true,
  });
  if (role) parsed.role = role;

  // `searchTerm` filters the fields below and also matches on the stored
  // role/status values, so searching "Blocked" or "Admin" narrows the list.
  const userQuery = new QueryBuilder(
    User.find({}),
    parsed,
    MEMBER_LIST_OPTIONS,
  ).search(["fullName", "email", "username"], ["status", "role"]);

  await userQuery.filter();

  userQuery.sort().paginate().fields();

  const result = await userQuery.modelQuery;
  const meta = await userQuery.countTotal();

  return { result, meta };
};

const getSingleUserByUsername = async (username: string) => {
  const user = await User.findOne({ username });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

// A profile form posts "" for the fields it cleared. A blank date clears the
// stored one; a blank gender or username is dropped, a blank photo is kept.
const normaliseProfilePayload = (payload: object) => {
  const update: Record<string, unknown> = { ...payload };

  if (update.dateOfBirth === "") update.dateOfBirth = null;
  if (update.gender === "") delete update.gender;
  if (update.username === "") delete update.username;

  return update;
};

// The same refusals as the availability answer, so a save and a live check
// cannot disagree about the same handle.
const assertUsernameAvailable = async (
  username: string,
  excludeId?: string,
) => {
  const refusal = await usernameRefusal(username, excludeId);
  if (refusal) throw new AppError(httpStatus.BAD_REQUEST, refusal);
};

/**
 * The account behind a session token, as the handle rules need it.
 *
 * Every refusal above is computed from what the database holds now, never from
 * what a form sent, so a second tab, a reload or a direct call sees the same
 * answer.
 */
const readerForUsername = async (userData: JwtPayload) => {
  const user = await User.findOne({ email: userData.email }).select(
    "username usernameChangedAt usernameOnboardedAt fullName email googleId +password",
  );

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return user;
};

/** The change rule for one account, as `username/state` and the profile both read it. */
const usernameChangeState = (user: {
  username: string;
  usernameChangedAt?: Date | null;
}) => {
  const lockedUntil = user.usernameChangedAt
    ? usernameLockEndsAt(user.usernameChangedAt)
    : null;
  const locked = Boolean(lockedUntil && lockedUntil.getTime() > Date.now());

  return {
    username: user.username,
    lockedUntil: locked && lockedUntil ? lockedUntil.toISOString() : null,
    canChange: !locked,
  };
};

/**
 * The handle to offer at the onboarding step.
 *
 * Always valid and free when it is shown, so "Save and continue" on the
 * suggestion is never a refusal. A suggestion is only ever a starting point:
 * a member who takes it is confirming a handle, and one who types another is
 * choosing it, and both are recorded the same way.
 */
const readUsernameOnboarding = async (userData: JwtPayload) => {
  const user = await readerForUsername(userData);
  const suggested = await freeUsername(
    suggestUsername(user.fullName, user.email),
    String(user._id),
  );

  // An account is onboarded if usernameOnboardedAt is set, OR if they registered with
  // a password (where username was explicitly chosen during signup).
  const hasSetUsername = Boolean(user.usernameOnboardedAt || user.password);

  // If they have set their username via password registration but usernameOnboardedAt
  // is missing, backfill it so it's permanently recorded.
  if (!user.usernameOnboardedAt && user.password) {
    const now = new Date();
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          usernameOnboardedAt: now,
          usernameChangedAt: user.usernameChangedAt ?? now,
        },
      },
    );
  }

  return {
    currentUsername: user.username,
    suggestedUsername: suggested,
    onboarded: hasSetUsername,
  };
};

/** Whether a handle cannot be claimed: held by someone, or still reserved. */
const isUsernameTakenOrReserved = async (
  username: string,
  excludeId?: string,
) => {
  const [held, reserved] = await Promise.all([
    User.findOne({
      username,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      .select("_id")
      .setOptions({ bypassMiddleware: true })
      .lean(),
    UsernameHistory.findOne({
      username,
      reservedUntil: { $gt: new Date() },
    })
      .select("_id")
      .lean(),
  ]);

  return Boolean(held || reserved);
};

/**
 * Why a handle cannot be claimed, in the sentence a form shows, or `null` if it
 * can.
 *
 * "Taken" and "reserved" are different facts and the member can act on both
 * differently ("try another" against "this one is retired"), so each is asked
 * for on its own rather than reported as one vague refusal.
 */
const usernameRefusal = async (username: string, excludeId?: string) => {
  const held = await User.findOne({
    username,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  })
    .select("_id")
    .setOptions({ bypassMiddleware: true })
    .lean();

  if (held) return "That username is already taken";

  const reserved = await UsernameHistory.findOne({
    username,
    reservedUntil: { $gt: new Date() },
  })
    .select("_id")
    .lean();

  return reserved ? "That username is reserved" : null;
};

/**
 * Whether a typed handle can be claimed, with the sentence to show if not.
 *
 * The wording is the shared rule's own, so the form, the API's validation and
 * this answer cannot describe the same handle three different ways.
 */
const checkUsernameAvailability = async (
  userData: JwtPayload | undefined,
  raw: string,
) => {
  const user = userData
    ? await readerForUsername(userData).catch(() => null)
    : null;
  const username = normaliseUsername(raw);

  const problem = usernameProblem(username);
  if (problem) return { username, available: false, reason: problem };

  // Keeping the handle you already have is not a refusal; it is a no-change.
  if (user && !isUsernameChange(user.username, username)) {
    return { username, available: true, reason: null };
  }

  const refusal = await usernameRefusal(
    username,
    user ? String(user._id) : undefined,
  );

  return { username, available: !refusal, reason: refusal };
};

/**
 * `base` with the smallest free suffix, and a base that is itself reserved
 * padded first (`admin` offers `admin_`), so a reserved word is never returned.
 *
 * Bounded: past a hundred attempts the caller gets a handle with a timestamp
 * suffix rather than a loop that never ends, and a hundred `ada_lovelace`
 * accounts is already the limit of a useful suggestion.
 */
const freeUsername = async (base: string, excludeId?: string) => {
  const first = isReservedUsername(base) ? `${base}_` : base;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = usernameWithSuffix(first, attempt);
    if (!isReservedUsername(candidate)) {
      if (!(await isUsernameTakenOrReserved(candidate, excludeId))) {
        return candidate;
      }
    }
  }

  return usernameWithSuffix(first, Date.now() % 1000);
};

/**
 * Confirm the handle at the step after a first sign-in.
 *
 * The step is the one place a new member picks a handle, so it is not bound by
 * the 30 day lock: an account reaches it with the placeholder Google or signup
 * invented, and the lock starts from the handle they chose here. It can only
 * run once, and only for the caller's own account.
 */
const completeUsernameOnboarding = async (
  userData: JwtPayload,
  raw: string,
) => {
  const user = await readerForUsername(userData);
  const username = normaliseUsername(raw);

  const problem = usernameProblem(username);
  if (problem) throw new AppError(httpStatus.BAD_REQUEST, problem);

  const changes = isUsernameChange(user.username, username);

  if (user.usernameOnboardedAt) {
    // A second submit (a double click, an old tab) is answered with the state
    // rather than an error, but it may not move the handle: that is a change,
    // and changes go through the profile and the lock.
    if (changes) {
      throw new AppError(
        httpStatus.CONFLICT,
        "Your username is already set. Change it from your profile.",
      );
    }

    return {
      ...usernameChangeState(user),
      onboarded: true,
    };
  }

  if (changes) await assertUsernameAvailable(username, String(user._id));

  const now = new Date();
  const updated = await User.findOneAndUpdate(
    { _id: user._id, usernameOnboardedAt: { $exists: false } },
    {
      $set: {
        username,
        usernameOnboardedAt: now,
        // The handle chosen here is where the lock starts, so the next change
        // is 30 days away rather than immediate.
        usernameChangedAt: now,
      },
    },
    { new: true, runValidators: true },
  );

  if (!updated) {
    // Another request got here first; answer with what it wrote.
    const current = await readerForUsername(userData);
    return { ...usernameChangeState(current), onboarded: true };
  }

  return { ...usernameChangeState(updated), onboarded: true };
};

/**
 * The current handle for one an address still carries.
 *
 * `null` when the handle was never held by anyone, which is the caller's cue to
 * render a normal not-found page rather than redirect.
 */
const findCurrentHandle = async (handle: string) => {
  const username = normaliseUsername(handle);
  if (!username) return null;

  const entry = await UsernameHistory.findOne({ username }).lean();
  if (!entry) return null;

  const holder = await User.findById(entry.userId)
    .select("username +isDeleted")
    .setOptions({ bypassMiddleware: true })
    .lean();

  // A deleted account has no profile to forward to; the address is simply gone.
  if (!holder || holder.isDeleted) return null;

  return { username: holder.username };
};

const getUsernameState = async (userData: JwtPayload) =>
  usernameChangeState(await readerForUsername(userData));

const updateProfile = async (userData: JwtPayload, payload: IUser) => {
  const user = await User.findOne({ email: userData.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const update = normaliseProfilePayload(payload);

  if (typeof update.username === "string") {
    // `validate` already normalised and shape-checked this field.
    const next = update.username;

    if (isUsernameChange(user.username, next)) {
      // The lock lives here, not in the form: the profile is one way to send
      // this field, and a direct call has to meet the same rule. It is read
      // from the stored account, so a client value means nothing.
      const lockedUntil = user.usernameChangedAt
        ? usernameLockEndsAt(user.usernameChangedAt)
        : null;

      if (lockedUntil && lockedUntil.getTime() > Date.now()) {
        throw new AppError(
          httpStatus.FORBIDDEN,
          `You can change your username on ${formatUsernameDate(lockedUntil)}. It is locked for ${USERNAME_CHANGE_LOCK_DAYS} days after each change so the links people saved to your profile keep working.`,
        );
      }

      const problem = usernameProblem(next);
      if (problem) throw new AppError(httpStatus.BAD_REQUEST, problem);

      await assertUsernameAvailable(next, String(user._id));

      const updatedUser = await User.findByIdAndUpdate(
        user._id,
        {
          ...update,
          username: next,
          usernameChangedAt: new Date(),
          // A member who changes a handle has, by that act, seen and chosen it
          // even if they never reached the step: the step is not asked again.
          ...(user.usernameOnboardedAt
            ? {}
            : { usernameOnboardedAt: new Date() }),
        },
        { new: true, runValidators: true },
      );

      if (!updatedUser) {
        throw new AppError(httpStatus.NOT_FOUND, "User not found");
      }

      // The old handle forwards to the new one, and is refused to everyone
      // else for as long as the forward lasts.
      await UsernameHistory.findOneAndUpdate(
        { username: user.username },
        {
          $set: {
            userId: String(user._id),
            reservedUntil: usernameReservationEndsAt(new Date()),
          },
        },
        { upsert: true },
      );

      return updatedUser;
    }

    // Confirming the handle you already hold is not a change: it falls through
    // with the trimmed, lowercased value and no new lock.
    update.username = next;
  }

  const updatedUser = await User.findByIdAndUpdate(user._id, update, {
    new: true,
    runValidators: true,
  });
  if (!updatedUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return updatedUser;
};

const updateProfileByAdmin = async (
  id: string,
  payload: IUser,
  adminEmail?: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user Id");
  }

  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const update = normaliseProfilePayload(payload);
  const previousUsername = user.username;
  let usernameMoved = false;

  if (typeof update.username === "string") {
    // The admin panel corrects a bad handle without waiting out the lock. The
    // old handle is still recorded below, so the member's saved links follow
    // the correction exactly as they follow their own rename.
    const next = normaliseUsername(update.username);
    usernameMoved = isUsernameChange(previousUsername, next);

    if (usernameMoved) {
      await assertUsernameAvailable(next, id);
      update.username = next;
    } else {
      update.username = next;
    }
  }

  const updatedUser = await User.findByIdAndUpdate(
    id,
    {
      ...update,
      ...(usernameMoved ? { usernameChangedAt: new Date() } : {}),
    },
    { new: true, runValidators: true },
  );
  if (!updatedUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (usernameMoved) {
    await UsernameHistory.findOneAndUpdate(
      { username: previousUsername },
      {
        $set: {
          userId: id,
          reservedUntil: usernameReservationEndsAt(new Date()),
        },
      },
      { upsert: true },
    );
  }

  await adminLogService.record({
    adminEmail,
    action: "user.update_profile",
    targetType: "user",
    targetId: id,
    summary: usernameMoved
      ? `Changed the username of ${user.fullName} from @${previousUsername} to @${updatedUser.username}`
      : `Updated profile for ${user.fullName} (@${user.username})`,
  });

  return updatedUser;
};

const updateSocialLinks = async (
  userData: JwtPayload,
  payload: TSocialLink[],
) => {
  const updatedUser = await User.findOneAndUpdate(
    { email: userData.email },
    payload,
    {
      new: true,
      runValidators: true,
    },
  );

  if (!updatedUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return updatedUser;
};

/**
 * Resolve interest ids to the categories that are still live, in the order the
 * reader picked them.
 *
 * One query for both jobs below: an id that comes back is a real category, and
 * its name is what a screen shows and what the feed reason reads.
 */
const liveInterests = async (ids: string[]) => {
  if (ids.length === 0) return [];

  const categories = await Category.find({ _id: { $in: ids } }).select("name");
  const byId = new Map(categories.map((row) => [String(row._id), row.name]));

  return ids.flatMap((id) => {
    const name = byId.get(id);
    return name ? [{ _id: id, name }] : [];
  });
};

/**
 * What the reader has picked, for the interests step and the profile section.
 *
 * `interests` is the saved list untouched, `names` only the ones a reader can
 * still see. A removed category therefore drops out of the screen without the
 * saved choice being rewritten.
 */
const getInterests = async (userData: JwtPayload) => {
  const user = await User.findOne({ email: userData.email }).select(
    "interests interestsAnsweredAt",
  );

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const saved = user.interests ?? [];
  const live = await liveInterests(saved);

  return {
    interests: saved,
    names: live.map((row) => row.name),
    answered: Boolean(user.interestsAnsweredAt),
  };
};

/**
 * Save the reader's interests, or their skip.
 *
 * Every id is checked against a live category first, so a stale tab cannot
 * store an id that names nothing. An empty list is accepted and is a real
 * answer; the date is what stops the step being asked again either way.
 *
 * `interestsAnsweredAt` is only set here, never cleared, so a second visit from
 * the profile edits the list without the first-sign-in step returning.
 */
const updateInterests = async (userData: JwtPayload, ids: string[]) => {
  const live = await liveInterests(ids);

  if (live.length !== ids.length) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "One of those categories is no longer available. Reload the page and pick again.",
    );
  }

  const user = await User.findOneAndUpdate(
    { email: userData.email },
    [
      {
        $set: {
          interests: { $literal: ids },
          // The first answer is the one that counts: a later edit from the
          // profile keeps the date it was given.
          interestsAnsweredAt: { $ifNull: ["$interestsAnsweredAt", "$$NOW"] },
        },
      },
    ],
    { new: true, runValidators: true },
  ).select("interests interestsAnsweredAt");

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  return {
    interests: user.interests ?? [],
    names: live.map((row) => row.name),
    answered: true,
  };
};

const blockUser = async (id: string, adminEmail?: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === USER_STATUS.BLOCKED) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already Blocked");
  }

  const result = await User.findByIdAndUpdate(
    id,
    { status: USER_STATUS.BLOCKED },
    { new: true, runValidators: true },
  );

  await adminLogService.record({
    adminEmail,
    action: "user.block",
    targetType: "user",
    targetId: id,
    summary: `Blocked ${user.fullName} (@${user.username})`,
  });

  return result;
};

const unBlockUser = async (id: string, adminEmail?: string) => {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.status === USER_STATUS.ACTIVE) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already Active");
  }

  const result = await User.findByIdAndUpdate(
    id,
    { status: USER_STATUS.ACTIVE },
    { new: true, runValidators: true },
  );

  await adminLogService.record({
    adminEmail,
    action: "user.unblock",
    targetType: "user",
    targetId: id,
    summary: `Unblocked ${user.fullName} (@${user.username})`,
  });

  return result;
};

const makeAdmin = async (id: string, adminEmail?: string) => {
  const user = await User.findById(id).select("+isDeleted");
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  if (user.status === USER_STATUS.BLOCKED) {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  if (user.role === USER_ROLE.ADMIN) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already an admin");
  }

  const result = await User.findByIdAndUpdate(
    id,
    { role: USER_ROLE.ADMIN },
    { new: true, runValidators: true },
  );

  await adminLogService.record({
    adminEmail,
    action: "user.make_admin",
    targetType: "user",
    targetId: id,
    summary: `Made ${user.fullName} (@${user.username}) an admin`,
  });

  return result;
};

/**
 * Erase a member's footprint inside a caller's transaction: the articles and
 * the counters they were counted in, comments, views, votes and follows.
 *
 * The account row itself is left alone; the caller decides whether to flag it
 * (trash) or delete it (permanent). Shared by both paths so a bulk delete
 * cannot clean up less than a single one does.
 */
const purgeMemberContent = async (
  userId: mongoose.Types.ObjectId,
  session: mongoose.ClientSession,
) => {
  await Blog.deleteMany({ author: userId }, { session });

  // `comment.post` is the stored field name.
  const userComments = await Comment.find({ user: userId }).session(session);
  for (const comment of userComments) {
    await Blog.findByIdAndUpdate(
      comment.post,
      { $inc: { totalComments: -1 } },
      { session },
    );
  }
  await Comment.deleteMany({ user: userId }, { session });

  // `view.post` is the stored field name.
  const userViews = await View.find({ user: userId }).session(session);
  for (const view of userViews) {
    await Blog.findByIdAndUpdate(
      view.post,
      { $inc: { totalViews: -1 } },
      { session },
    );
  }
  await View.deleteMany({ user: userId }, { session });

  // `vote.post` is the stored field name.
  const userVotes = await Vote.find({ user: userId }).session(session);
  for (const vote of userVotes) {
    if (vote.type === "upvote") {
      await Blog.findByIdAndUpdate(
        vote.post,
        { $inc: { upVotes: -1 } },
        { session },
      );
    } else if (vote.type === "downvote") {
      await Blog.findByIdAndUpdate(
        vote.post,
        { $inc: { downVotes: -1 } },
        { session },
      );
    }
  }
  await Vote.deleteMany({ user: userId }, { session });

  await Follower.deleteMany({ follower: userId }, { session });
  await Follower.deleteMany({ following: userId }, { session });
};

const deleteUserAccount = async (id: string, adminEmail?: string) => {
  const user = await User.findById(id).select("+isDeleted");
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  if (user.role === USER_ROLE.ADMIN) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Admin users cannot delete accounts",
    );
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await purgeMemberContent(user._id, session);

    user.isDeleted = true;
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }

  await adminLogService.record({
    adminEmail,
    action: "user.delete",
    targetType: "user",
    targetId: id,
    summary: `Deleted account ${user.fullName} (@${user.username})`,
  });
};

const getDeletedUsers = async (rawQuery: Record<string, unknown>) => {
  const { page, limit } = pageParams(rawQuery);
  // Same visible columns as the member table: name, handle and address.
  const search = buildSearchFilter(rawQuery.searchTerm, {
    leaf: (escaped) => {
      const match = {
        $regex: escaped.length >= 3 ? `^${escaped}` : escaped,
        $options: "i",
      };

      return {
        $or: [{ fullName: match }, { username: match }, { email: match }],
      };
    },
  });

  // The find hook hides deleted members, so the trash view is the one place
  // that opts out of it and asks for them itself.
  const deletedFilter = {
    $and: [{ isDeleted: true }, ...(search ? [search] : [])],
  } as FilterQuery<IUser>;

  const [result, total] = await Promise.all([
    User.find(deletedFilter)
      .setOptions({ bypassMiddleware: true })
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(
        "fullName username email profilePicture role status createdAt updatedAt totalPosts",
      )
      .lean(),
    // countDocuments runs no find hook, so it already counts deleted rows.
    User.countDocuments(deletedFilter),
  ]);

  return {
    result,
    meta: {
      limit,
      page,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

const restoreUser = async (id: string, adminEmail?: string) => {
  // A malformed id is a bad request, not a server fault: the driver's own
  // ObjectId constructor throws a plain error that would surface as a 500.
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user Id");
  }

  // The find hook hides deleted members, so read the raw document.
  const raw = await User.collection.findOne({
    _id: new mongoose.Types.ObjectId(id),
  });
  if (!raw) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (raw.isDeleted !== true) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is not deleted");
  }

  // Only the flag is flipped: deleting an account purges its blogs, comments,
  // views and votes, so a restored member comes back with an empty profile.
  const result = await User.findByIdAndUpdate(
    id,
    { isDeleted: false },
    { new: true, runValidators: true },
  );

  await adminLogService.record({
    adminEmail,
    action: "user.restore",
    targetType: "user",
    targetId: id,
    summary: `Restored account ${raw.fullName} (@${raw.username})`,
  });

  return result;
};

/**
 * Erase a deleted member for good.
 *
 * Only a member already in the trash can be erased, so the accounts, articles,
 * comments, views and votes were purged on the way in and are not touched
 * here; each is deleted again to keep an older leftover from outliving the
 * account. The handle records go too: they exist to forward an old address to
 * the member, and there is nobody left to forward to, so the handles are free
 * for someone else rather than reserved forever.
 */
/**
 * Erase trashed members for good, inside a caller's transaction.
 *
 * Only members already in the trash go, so their articles, comments, views and
 * votes were purged on the way in; anything older is deleted again so it
 * cannot outlive the account. The handle records go too: they exist to forward
 * an old address to the member, and there is nobody left to forward to, so if
 * they stayed, nobody could ever use those handles again. Returns the accounts
 * erased, for the log line.
 */
const eraseTrashedMembers = async (objectIds: mongoose.Types.ObjectId[]) => {
  await Promise.all([
    Blog.deleteMany({ author: { $in: objectIds } }),
    Comment.deleteMany({ user: { $in: objectIds } }),
    View.deleteMany({ user: { $in: objectIds } }),
    Vote.deleteMany({ user: { $in: objectIds } }),
    Follower.deleteMany({ follower: { $in: objectIds } }),
    Follower.deleteMany({ following: { $in: objectIds } }),
    UsernameHistory.deleteMany({
      userId: { $in: objectIds.map((id) => String(id)) },
    }),
  ]);

  const raws = await User.collection
    .find({ _id: { $in: objectIds } })
    .project({ fullName: 1, username: 1 })
    .toArray();

  await User.deleteMany({ _id: { $in: objectIds } });

  return raws;
};

const deleteUserAccountPermanently = async (
  id: string,
  adminEmail?: string,
) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user Id");
  }

  // The find hook hides deleted members, so read the raw document.
  const raw = await User.collection.findOne({
    _id: new mongoose.Types.ObjectId(id),
  });
  if (!raw) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (raw.isDeleted !== true) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Move the account to the trash before deleting it permanently",
    );
  }

  await eraseTrashedMembers([raw._id]);

  await adminLogService.record({
    adminEmail,
    action: "user.delete_permanent",
    targetType: "user",
    targetId: String(raw._id),
    summary: `Permanently deleted account ${raw.fullName} (@${raw.username})`,
    meta: { email: raw.email },
  });

  return {
    _id: String(raw._id),
    fullName: raw.fullName,
    username: raw.username,
  };
};

/**
 * Move several members to the trash in one step.
 *
 * An admin account refuses the whole selection, because the single action
 * refuses it too. A member already in the trash is skipped rather than
 * refused: its content was purged the first time, so counting it again would
 * take nothing from anyone.
 */
const deleteUsersInBulk = async (ids: string[], adminEmail?: string) => {
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const raws = await User.collection
    .find({ _id: { $in: objectIds } })
    .project({ fullName: 1, username: 1, role: 1, isDeleted: 1 })
    .toArray();

  if (raws.length !== ids.length) {
    throw new AppError(httpStatus.NOT_FOUND, "Some members were not found");
  }

  const admins = raws.filter((raw) => raw.role === USER_ROLE.ADMIN);
  if (admins.length > 0) {
    const names = admins
      .map((raw) => `${raw.fullName} (@${raw.username})`)
      .join(", ");
    throw new AppError(
      httpStatus.FORBIDDEN,
      `Admin accounts cannot be deleted: ${names}`,
    );
  }

  const targets = raws.filter((raw) => raw.isDeleted !== true);
  if (targets.length === 0) return { deleted: 0, skipped: raws.length };

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const raw of targets) {
      await purgeMemberContent(raw._id, session);
    }

    await User.updateMany(
      { _id: { $in: targets.map((raw) => raw._id) } },
      { isDeleted: true },
      { session, runValidators: true },
    );

    await session.commitTransaction();
    await session.endSession();
  } catch (error) {
    await session.abortTransaction();
    await session.endSession();
    throw error;
  }

  await adminLogService.record({
    adminEmail,
    action: "user.delete",
    targetType: "user",
    targetId: ids[0],
    summary:
      targets.length === 1
        ? `Deleted account ${targets[0].fullName} (@${targets[0].username})`
        : `Deleted ${targets.length} accounts`,
    meta: {
      count: targets.length,
      usernames: targets.map((raw) => raw.username),
    },
  });

  return { deleted: targets.length, skipped: raws.length - targets.length };
};

/**
 * Erase several trashed members for good.
 *
 * Every id must already be in the trash, the same rule the single endpoint
 * keeps, and one live account refuses the whole selection.
 */
const deleteUsersPermanently = async (ids: string[], adminEmail?: string) => {
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const raws = await User.collection
    .find({ _id: { $in: objectIds } })
    .project({ fullName: 1, username: 1, isDeleted: 1 })
    .toArray();

  if (raws.length !== ids.length) {
    throw new AppError(httpStatus.NOT_FOUND, "Some members were not found");
  }
  if (raws.some((raw) => raw.isDeleted !== true)) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Move the account to the trash before deleting it permanently",
    );
  }

  const erased = await eraseTrashedMembers(objectIds);

  await adminLogService.record({
    adminEmail,
    action: "user.delete_permanent",
    targetType: "user",
    targetId: ids[0],
    summary:
      erased.length === 1
        ? `Permanently deleted account ${erased[0].fullName} (@${erased[0].username})`
        : `Permanently deleted ${erased.length} accounts`,
    meta: { count: erased.length },
  });

  return { deleted: erased.length };
};

const followUser = async (userData: JwtPayload, userIdToFollow: string) => {
  const session = await mongoose.startSession();
  let totalFollowers;

  try {
    session.startTransaction();

    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const userToFollow = await User.findById(userIdToFollow).session(session);
    if (!userToFollow) {
      throw new AppError(httpStatus.NOT_FOUND, "User to follow not found");
    }

    if (currentLoggedInUser._id.equals(userToFollow._id)) {
      throw new AppError(httpStatus.BAD_REQUEST, "You cannot follow yourself");
    }

    const existingFollow = await Follower.findOne({
      follower: currentLoggedInUser._id,
      following: userToFollow._id,
    }).session(session);

    if (existingFollow) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You are already following this user",
      );
    }

    await Follower.create(
      [
        {
          follower: currentLoggedInUser._id,
          following: userToFollow._id,
          followedAt: new Date(),
        },
      ],
      { session },
    );

    // Update totalFollowers for userToFollow
    userToFollow.totalFollowers += 1;
    totalFollowers = Math.max(0, userToFollow.totalFollowers);
    await userToFollow.save({ session, validateModifiedOnly: true });

    // Update totalFollowing for currentLoggedInUser
    currentLoggedInUser.totalFollowing += 1;
    await currentLoggedInUser.save({ session, validateModifiedOnly: true });

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  return {
    userId: userIdToFollow,
    isFollowing: true,
    totalFollowers,
  };
};

// Unfollow a user with transaction
const unfollowUser = async (userData: JwtPayload, userIdToUnfollow: string) => {
  const session = await mongoose.startSession();
  let totalFollowers;

  try {
    session.startTransaction();

    const currentLoggedInUser = await User.findOne({
      email: userData.email,
    }).session(session);

    if (!currentLoggedInUser) {
      throw new AppError(httpStatus.NOT_FOUND, "User not found");
    }

    const userToUnfollow =
      await User.findById(userIdToUnfollow).session(session);
    if (!userToUnfollow) {
      throw new AppError(httpStatus.NOT_FOUND, "User to unfollow not found");
    }

    if (currentLoggedInUser._id.equals(userToUnfollow._id)) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You cannot unfollow yourself",
      );
    }

    const existingFollow = await Follower.findOne({
      follower: currentLoggedInUser._id,
      following: userToUnfollow._id,
    }).session(session);

    if (!existingFollow) {
      throw new AppError(
        httpStatus.BAD_REQUEST,
        "You are not following this user",
      );
    }

    await Follower.deleteOne({
      follower: currentLoggedInUser._id,
      following: userToUnfollow._id,
    }).session(session);

    userToUnfollow.totalFollowers -= 1;
    totalFollowers = Math.max(0, userToUnfollow.totalFollowers);
    await userToUnfollow.save({ session, validateModifiedOnly: true });

    currentLoggedInUser.totalFollowing -= 1;
    await currentLoggedInUser.save({ session, validateModifiedOnly: true });

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }

  return {
    userId: userIdToUnfollow,
    isFollowing: false,
    totalFollowers,
  };
};

// Whether the reader follows this member, and the member's current count.
// Reading is never a fault here: "not following" is the answer for most
// readers, and the page needs the count next to the button either way.
const getFollowStatus = async (
  userData: JwtPayload,
  userIdToFollow: string,
) => {
  const currentLoggedInUser = await User.findOne({
    email: userData.email,
  });

  if (!currentLoggedInUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const userToFollow = await User.findById(userIdToFollow);
  if (!userToFollow) {
    throw new AppError(httpStatus.NOT_FOUND, "User to follow not found");
  }

  const followStatus = await Follower.findOne({
    follower: currentLoggedInUser._id,
    following: userIdToFollow,
  });

  return {
    userId: userToFollow._id,
    isFollowing: !!followStatus,
    totalFollowers: userToFollow.totalFollowers,
  };
};

// get current logged in user followers
const getLoggedInUserFollowers = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  const currentLoggedInUser = await User.findOne({
    email: userData.email,
  });

  if (!currentLoggedInUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  const followersQuery = new QueryBuilder(
    Follower.find({ following: currentLoggedInUser._id })
      .populate(
        "follower",
        "fullName username email profilePicture totalFollowers totalFollowing",
      )
      .select("follower"),
    query,
  );

  await followersQuery.filter();

  followersQuery.sort().paginate().fields();

  const result = await followersQuery.modelQuery;
  const meta = await followersQuery.countTotal();

  return { result, meta };
};

// get current logged in user following
const getLoggedInUserFollowing = async (
  userData: JwtPayload,
  query: Record<string, unknown>,
) => {
  const currentLoggedInUser = await User.findOne({
    email: userData.email,
  });

  if (!currentLoggedInUser) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const followingQuery = new QueryBuilder(
    Follower.find({ follower: currentLoggedInUser._id })
      .populate(
        "following",
        "fullName username email profilePicture totalFollowers totalFollowing",
      )
      .select("following"),
    query,
  );

  await followingQuery.filter();

  followingQuery.sort().paginate().fields();

  const result = await followingQuery.modelQuery;
  const meta = await followingQuery.countTotal();

  return { result, meta };
};

// get all followers by user id
const getFollowersByUserId = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const followersQuery = new QueryBuilder(
    Follower.find({ following: user._id })
      .populate(
        "follower",
        "fullName username email profilePicture totalFollowers totalFollowing",
      )
      .select("follower"),
    query,
  );

  await followersQuery.filter();

  followersQuery.sort().paginate().fields();

  const result = await followersQuery.modelQuery;
  const meta = await followersQuery.countTotal();

  return { result, meta };
};

// get all following by user id
const getFollowingByUserId = async (
  userId: string,
  query: Record<string, unknown>,
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  const followingQuery = new QueryBuilder(
    Follower.find({ follower: user._id })
      .populate(
        "following",
        "fullName username email profilePicture totalFollowers totalFollowing",
      )
      .select("following"),
    query,
  );

  await followingQuery.filter();

  followingQuery.sort().paginate().fields();

  const result = await followingQuery.modelQuery;
  const meta = await followingQuery.countTotal();

  return { result, meta };
};

const resendVerificationEmail = async (id: string, adminEmail?: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid user Id");
  }

  const user = await User.findById(id).select("+isDeleted");
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Restore the account before sending a verification email",
    );
  }

  if (user.status === USER_STATUS.BLOCKED) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Unblock the account before sending a verification email",
    );
  }

  if (user.isVerified) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "This email address is already verified",
    );
  }

  if (!isEmailConfigured()) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Email sending is not configured on the server",
    );
  }

  const verifyToken = User.createToken(
    { email: user.email, role: user.role },
    config.JWT_RESET_PASSWORD_SECRET,
    config.JWT_VERIFY_EMAIL_EXPIRES_IN,
  );

  const verifyUrl = `${config.API_BASE_URL}/auth/verify-email?email=${encodeURIComponent(
    user.email,
  )}&token=${verifyToken}`;

  const mail = await verifyEmailMessage({
    fullName: user.fullName,
    verifyUrl,
    expiresIn: durationLabel(config.JWT_VERIFY_EMAIL_EXPIRES_IN),
  });

  await sendEmail({
    to: {
      name: user.fullName,
      address: user.email,
    },
    sender: "security",
    category: "email-verification",
    ...mail,
  });

  await adminLogService.record({
    adminEmail,
    action: "user.resend_verification",
    targetType: "user",
    targetId: id,
    summary: `Resent verification email to ${user.email}`,
  });

  return { email: user.email };
};

export const userService = {
  getAllUsers,
  updateProfile,
  updateProfileByAdmin,
  updateSocialLinks,
  getInterests,
  updateInterests,
  readUsernameOnboarding,
  checkUsernameAvailability,
  completeUsernameOnboarding,
  getUsernameState,
  findCurrentHandle,
  blockUser,
  unBlockUser,
  resendVerificationEmail,
  followUser,
  unfollowUser,
  getLoggedInUserFollowers,
  getLoggedInUserFollowing,
  getFollowersByUserId,
  getFollowingByUserId,
  getSingleUserByUsername,
  getFollowStatus,
  makeAdmin,
  deleteUserAccount,
  getDeletedUsers,
  restoreUser,
  deleteUserAccountPermanently,
  deleteUsersInBulk,
  deleteUsersPermanently,
};
