import httpStatus from "http-status";
import jwt, { JwtPayload } from "jsonwebtoken";
import {
  USERNAME_MIN_LENGTH,
  isReservedUsername,
  normaliseUsername,
  usernameWithSuffix,
} from "@techtipshub/shared";
import config from "../../config";
import {
  durationLabel,
  passwordResetEmailMessage,
  verifyEmailMessage,
} from "../../emails";
import { AppError } from "../../errors";
import { isEmailConfigured, sendEmail } from "../../utils";
import { IUser } from "../user/user.interface";
import type { IGoogleProfile } from "./google-oauth";
import User from "../user/user.model";
import UsernameHistory from "../user/username-history.model";

/** Said when a reset token arrives after the password it belongs to changed. */
const RESET_USED_MESSAGE =
  "This reset link has already been used. Request a new one if you still need to change the password.";

const register = async (payload: IUser) => {
  const existedEmail = await User.findOne({
    email: payload.email,
  })
    .select("+isDeleted")
    .lean()
    .setOptions({ bypassMiddleware: true });

  if (existedEmail) {
    if (existedEmail.isDeleted) {
      throw new AppError(
        409,
        "Email linked to a deleted account. Recover or try a different email.",
      );
    }
    throw new AppError(409, "User already registered");
  }

  const existedUsername = await User.findOne({ username: payload.username })
    .select("+isDeleted")
    .lean()
    .setOptions({ bypassMiddleware: true });
  if (existedUsername) {
    if (existedUsername.isDeleted) {
      throw new AppError(
        409,
        "Username linked to a deleted account. Recover or try a different username.",
      );
    }
    throw new AppError(409, "Username already exists");
  }

  // A handle a member gave up is still forwarding to their profile, so it is
  // refused here too: registration is the other way one could be claimed.
  const reserved = await UsernameHistory.exists({
    username: payload.username,
    reservedUntil: { $gt: new Date() },
  });
  if (reserved) {
    throw new AppError(409, "Username is reserved");
  }

  const now = new Date();
  const newUser = await User.create({
    ...payload,
    usernameOnboardedAt: now,
    usernameChangedAt: now,
  });

  const jwtPayload = {
    email: newUser.email,
    role: newUser.role,
  };

  const verifyToken = User.createToken(
    jwtPayload,
    config.JWT_RESET_PASSWORD_SECRET,
    config.JWT_VERIFY_EMAIL_EXPIRES_IN,
  );

  const verifyEmailLink = `${config.API_BASE_URL}/auth/verify-email?email=${encodeURIComponent(
    newUser.email,
  )}&token=${verifyToken}`;

  // send verify email link
  const mail = await verifyEmailMessage({
    fullName: newUser.fullName,
    verifyUrl: verifyEmailLink,
    expiresIn: durationLabel(config.JWT_VERIFY_EMAIL_EXPIRES_IN),
  });

  await sendEmail({
    to: {
      name: newUser.fullName,
      address: newUser.email,
    },
    sender: "security",
    category: "email-verification",
    ...mail,
  });

  // eslint-disable-next-line no-console
  console.log(`Verify email link sent to ${newUser.email}`);

  return newUser;
};

/**
 * Issue a session for an account.
 *
 * The one place tokens are minted, and the reason `tokenVersion` reaches both
 * of them: a token is only honoured while the account still carries the same
 * version, so raising it ends every session cheaply.
 */
const issueSession = (user: {
  _id: unknown;
  profilePicture?: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  tokenVersion?: number;
}) => {
  const jwtPayload = {
    _id: user._id,
    profilePicture: user.profilePicture,
    username: user.username,
    name: user.fullName,
    email: user.email,
    role: user.role,
    tokenVersion: user.tokenVersion ?? 0,
  };

  return {
    accessToken: User.createToken(
      jwtPayload,
      config.JWT_ACCESS_TOKEN_SECRET,
      config.JWT_ACCESS_TOKEN_EXPIRES_IN,
    ),
    refreshToken: User.createToken(
      jwtPayload,
      config.JWT_REFRESH_TOKEN_SECRET,
      config.JWT_REFRESH_TOKEN_EXPIRES_IN,
    ),
    user: publicUser(user),
  };
};

const login = async (payload: IUser) => {
  const user = await User.findOne({ email: payload.email }).select(
    "+password +isDeleted",
  );

  if (!user) {
    throw new AppError(404, "User not found");
  }

  if (!user.password) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Incorrect credentials");
  }

  if (!(await User.isPasswordMatch(payload.password, user.password))) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Incorrect credentials");
  }

  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
  }

  return issueSession(user);
};

/**
 * Sign in (or sign up) with a Google account.
 *
 * Google has already confirmed who the reader is, so no password is checked.
 * The account is matched by Google's own id first, then (for accounts that
 * predate the id being stored) by the verified address:
 *
 * - Nothing matches: an account is created, already verified because Google
 *   vouched for the mailbox, with a username nobody holds yet.
 * - The Google id belongs to an account: signed in.
 * - The address belongs to an account with a password: signed in, and the
 *   Google id is recorded so the link is explicit from then on. This is the
 *   case the product wants: a member who set a password can still use Google.
 *
 * `isVerified` means "somebody proved this address", and Google proving it is
 * its own proof: the profile is refused unless Google reports the address as
 * verified (see `google-oauth.ts`). So a Google signup never needs the email
 * round trip a password signup is sent on, and an existing password account
 * that signs in with Google loses no standing by doing so.
 *
 * Refused: a soft-deleted account, a blocked one, and a Google id that is
 * already attached to a *different* account. That last one is the account
 * takeover attempt Google's id exists to catch: it means a second address now
 * signed in as a Google user this site already knows.
 */
const googleLogin = async (profile: IGoogleProfile) => {
  const byGoogleId = await User.findOne({ googleId: profile.sub })
    .select("+isDeleted")
    .setOptions({
      bypassMiddleware: true,
    });

  if (byGoogleId?.isDeleted) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "The account linked to this Google sign-in was deleted.",
    );
  }

  // A Google id on one account and a different address arriving with it is
  // never a legitimate sign-in.
  if (
    byGoogleId &&
    byGoogleId.email.toLowerCase() !== profile.email.toLowerCase()
  ) {
    throw new AppError(
      httpStatus.CONFLICT,
      "This Google account is already linked to a different TechTipsHub account.",
    );
  }

  const byEmail = await User.findOne({ email: profile.email })
    .select("+isDeleted")
    .setOptions({
      bypassMiddleware: true,
    });

  if (byEmail?.isDeleted) {
    throw new AppError(
      httpStatus.FORBIDDEN,
      "Email linked to a deleted account. Recover it or use another address.",
    );
  }

  if (byEmail && byEmail.googleId && byEmail.googleId !== profile.sub) {
    throw new AppError(
      httpStatus.CONFLICT,
      "This email is linked to a different Google account. Sign in with that one.",
    );
  }

  const account = byGoogleId ?? byEmail;

  if (account?.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  const user =
    account ??
    (await User.create({
      fullName: profile.name,
      // The handle Google signup invents is a placeholder, not a choice: the
      // member sees it at the username step, where the shared suggestion is
      // prefilled and this value is only what they are moving away from.
      username: await uniqueUsername(profile),
      email: profile.email,
      profilePicture: profile.picture,
      isVerified: true,
      googleId: profile.sub,
    }));

  // Record the link, and that Google vouched for the address: a member who
  // joined with a password may still be showing as unverified from signup.
  if (!user.googleId) user.googleId = profile.sub;
  if (!user.isVerified) user.isVerified = true;

  if (user.isModified("googleId") || user.isModified("isVerified")) {
    await user.save();
  }

  return issueSession(user);
};

/**
 * `ada.lovelace@example.com` reads as `adalovelace`, never as an empty name.
 *
 * The name is preferred over the address because it is what a reader will look
 * for, and it is the same normaliser the onboarding step offers, so the handle
 * a Google member first holds and the one they are offered are the same shape.
 */
const usernameBase = (profile: IGoogleProfile) => {
  const fromName = normaliseUsername(profile.name ?? "");
  if (fromName.length >= USERNAME_MIN_LENGTH && !isReservedUsername(fromName)) {
    return fromName;
  }

  const fromEmail = normaliseUsername(
    (profile.email ?? "").split("@")[0] ?? "",
  );
  if (
    fromEmail.length >= USERNAME_MIN_LENGTH &&
    !isReservedUsername(fromEmail)
  ) {
    return fromEmail;
  }

  return "member";
};

/**
 * A username nobody holds yet.
 *
 * A numeric suffix keeps it readable until the reader changes it at the
 * username step, which follows a first sign-in. Historical handles count as
 * held: a Google member may not be handed an address that still redirects to
 * somebody else's profile.
 */
const uniqueUsername = async (profile: IGoogleProfile) => {
  const base = usernameBase(profile);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = usernameWithSuffix(base, attempt);

    if (await takenOrReserved(candidate)) continue;

    return candidate;
  }

  return usernameWithSuffix(base, Date.now() % 1000);
};

const takenOrReserved = async (username: string) => {
  const [held, reserved] = await Promise.all([
    User.exists({ username }),
    UsernameHistory.exists({
      username,
      reservedUntil: { $gt: new Date() },
    }),
  ]);

  return Boolean(held || reserved);
};

const getMe = async (payload: JwtPayload) => {
  const user = await User.findOne({ email: payload.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }
  return user;
};

const changePassword = async (
  userData: JwtPayload,
  payload: { oldPassword: string; newPassword: string },
) => {
  const user = await User.findOne({ email: userData.email }).select(
    "+password +isDeleted",
  );

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  const isPasswordMatch = await User.isPasswordMatch(
    payload.oldPassword,
    user?.password,
  );
  if (!isPasswordMatch) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Password did not match");
  }

  const newHashedPassword = await User.generateHashPassword(
    payload.newPassword,
  );

  return await User.findOneAndUpdate(
    {
      email: userData.email,
      role: userData.role,
    },
    {
      password: newHashedPassword,
      passwordChangeAt: new Date(),
      // A password change is often the response to a leaked one, so every
      // session opened with the old password ends with it.
      $inc: { tokenVersion: 1 },
    },
    { new: true, runValidators: true },
  );
};

const forgetPassword = async (email: string) => {
  const user = await User.findOne({ email }).select("+isDeleted");
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  // Refuse up front rather than report a link "sent" that never leaves the
  // server. The UI shows a clear message when mail is not configured.
  if (!isEmailConfigured()) {
    throw new AppError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Email delivery is not configured on this server yet, so a reset link cannot be sent.",
    );
  }

  const jwtPayload = {
    email: user.email,
    role: user.role,
  };

  const resetToken = User.createToken(
    jwtPayload,
    config.JWT_RESET_PASSWORD_SECRET,
    config.JWT_RESET_PASSWORD_EXPIRES_IN,
  );

  // The reset form lives in this site (`/reset-password`), so the link is
  // built from the same base every other link to the site uses. The token
  // travels in the fragment so it is never sent to a server in a Referer
  // header or access log.
  const site = config.CLIENT_BASE_URL.replace(/\/$/, "");
  const resetUILink = `${site}/reset-password?email=${encodeURIComponent(
    user.email,
  )}#token=${resetToken}`;

  const mail = await passwordResetEmailMessage({
    fullName: user.fullName,
    resetUrl: resetUILink,
    expiresIn: durationLabel(config.JWT_RESET_PASSWORD_EXPIRES_IN),
  });

  await sendEmail({
    to: {
      name: user.fullName,
      address: user.email,
    },
    sender: "security",
    category: "password-reset",
    // A reset mail that fails to send must not be reported as sent.
    throwOnError: true,
    ...mail,
  });

  // eslint-disable-next-line no-console
  console.log(`Password reset link sent to ${user.email}`);

  // Enough for the UI to confirm where the mail went, and nothing more.
  return { email: user.email };
};

const resetPassword = async (
  payload: { newPassword: string },
  token: string,
) => {
  // Verify the link's token first so an expired or tampered link reports that
  // clearly. The account comes from the token itself - never from a field the
  // caller can edit - so a valid link can only ever reset its own account.
  let decoded: JwtPayload;
  try {
    decoded = User.verifyToken(
      token,
      config.JWT_RESET_PASSWORD_SECRET,
    ) as JwtPayload;
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.name === "TokenExpiredError"
        ? "This reset link has expired. Request a new one."
        : "This reset link is not valid. Request a new one.";
    throw new AppError(httpStatus.FORBIDDEN, message);
  }

  const user = await User.findOne({ email: decoded.email }).select(
    "+isDeleted +password",
  );
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // The page promises the link works once. A reset written after this token
  // was issued means it has already been used, so it is spent. `iat` is whole
  // seconds and `passwordChangeAt` has milliseconds, so the comparison allows
  // for the second the token was minted in: the reset that consumes this link
  // is written later than that.
  const changedAt = user.passwordChangeAt?.getTime();
  const issuedAt = typeof decoded.iat === "number" ? decoded.iat * 1000 : 0;
  if (changedAt && issuedAt && changedAt > issuedAt + 999) {
    throw new AppError(httpStatus.FORBIDDEN, RESET_USED_MESSAGE);
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  const newHashedPassword = await User.generateHashPassword(
    payload.newPassword,
  );

  return await User.findOneAndUpdate(
    {
      email: decoded.email,
      role: decoded.role,
    },
    {
      password: newHashedPassword,
      passwordChangeAt: new Date(),
      // A reset is the answer to a lost account, so every session that existed
      // before it is assumed to be unknown and is ended.
      $inc: { tokenVersion: 1 },
    },
    {
      new: true,
      runValidators: true,
    },
  );
};

/**
 * The account behind a refresh token, or a refusal.
 *
 * Every way a session can end is checked here in one place: the token's
 * signature and expiry, the account existing and being usable, the password
 * not having changed since, and `tokenVersion` still matching what the token
 * was signed with. `generateNewAccessToken`, `logOut` and the session route all
 * come through it, so none of them can be looser than the others.
 */
const userForRefreshToken = async (refreshToken: string) => {
  let decoded: JwtPayload;

  try {
    decoded = User.verifyToken(
      refreshToken,
      config.JWT_REFRESH_TOKEN_SECRET,
    ) as JwtPayload;
  } catch {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Session expired. Sign in again.",
    );
  }

  const user = await User.findOne({ email: decoded.email }).select(
    "+isDeleted +password",
  );
  if (!user) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Session expired. Sign in again.",
    );
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is already deleted");
  }

  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  if (
    (decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0) ||
    (user.passwordChangeAt &&
      User.isJWTIssuedBeforePasswordChanged(
        user.passwordChangeAt,
        decoded.iat as number,
      ))
  ) {
    throw new AppError(
      httpStatus.UNAUTHORIZED,
      "Session ended. Sign in again.",
    );
  }

  return user;
};

const generateNewAccessToken = async (refreshToken: string) => {
  const user = await userForRefreshToken(refreshToken);

  return {
    accessToken: issueSession(user).accessToken,
    user: publicUser(user),
  };
};

/**
 * End every session for the account behind this refresh token.
 *
 * Raising `tokenVersion` is what makes this real: the cookies go from the
 * browser either way, but a copy of the refresh token taken earlier stops
 * working at its next check instead of lasting out its full lifetime.
 */
const logOut = async (refreshToken: string | undefined) => {
  if (!refreshToken) return;

  try {
    const user = await userForRefreshToken(refreshToken);

    await User.updateOne({ _id: user._id }, { $inc: { tokenVersion: 1 } });
  } catch {
    // A token that is already invalid needs no revoking. Signing out must
    // still succeed and clear the browser, or a member is stuck signed in.
  }
};

/** What the site is allowed to know about the signed-in reader. */
const publicUser = (user: {
  _id: unknown;
  email: string;
  fullName: string;
  username: string;
  profilePicture?: string;
  role: string;
  usernameOnboardedAt?: Date | null;
  password?: string;
}) => ({
  _id: String(user._id),
  email: user.email,
  name: user.fullName,
  username: user.username,
  profilePicture: user.profilePicture ?? "",
  role: user.role,
  // The site decides where a sign-in lands from this flag: an account is onboarded
  // if they confirmed the handle, or if they signed up with a password (where username
  // was explicitly chosen during registration).
  usernameOnboarded: Boolean(user.usernameOnboardedAt || user.password),
});

/**
 * The signed-in reader, decided here rather than decoded by the site.
 *
 * The site sends the cookies back and gets an answer: who is signed in, and
 * what role they hold. It never reads a token, so the rules for an expired
 * access token, a revoked session and a role change live in one place. An
 * access token that still looks valid but has been revoked falls back to the
 * refresh token, so a rotation of `tokenVersion` takes effect immediately
 * rather than whenever the old access token expires.
 */
const readSession = async (
  accessToken: string | undefined,
  refreshToken: string | undefined,
) => {
  // A live access token whose version still matches is enough. The database
  // read is what makes a sign-out take effect at once instead of whenever the
  // token would have expired on its own.
  if (accessToken) {
    try {
      const decoded = jwt.verify(
        accessToken,
        config.JWT_ACCESS_TOKEN_SECRET,
      ) as JwtPayload;

      const current = decoded.email
        ? await User.findOne({ email: decoded.email }).select(
            "email fullName username profilePicture role tokenVersion status +isDeleted usernameOnboardedAt +password",
          )
        : null;

      if (
        current &&
        !current.isDeleted &&
        current.status !== "Blocked" &&
        (decoded.tokenVersion ?? 0) === (current.tokenVersion ?? 0)
      ) {
        return { signedIn: true as const, user: publicUser(current) };
      }
    } catch {
      // Expired or malformed: the refresh token gets its turn below.
    }
  }

  if (refreshToken) {
    try {
      const user = await userForRefreshToken(refreshToken);

      return {
        signedIn: true as const,
        user: publicUser(user),
        renewed: issueSession(user),
      };
    } catch {
      // Fall through: no usable session.
    }
  }

  return { signedIn: false as const };
};

/**
 * Confirm an email address from the verification link sent at registration or
 * resent by an admin.
 */
const verifyEmail = async (email: string, token: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !token.trim()) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Verification link is incomplete.",
    );
  }

  let decoded: JwtPayload;
  try {
    decoded = User.verifyToken(
      token,
      config.JWT_RESET_PASSWORD_SECRET,
    ) as JwtPayload;
  } catch {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Verification link is invalid or has expired.",
    );
  }

  if (
    typeof decoded.email !== "string" ||
    decoded.email.trim().toLowerCase() !== normalizedEmail
  ) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Verification link does not match this email address.",
    );
  }

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found.");
  }

  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "This account is blocked.");
  }

  if (!user.isVerified) {
    user.isVerified = true;
    await user.save();
  }

  return { email: user.email, verified: true };
};

export const authService = {
  register,
  login,
  googleLogin,
  getMe,
  changePassword,
  forgetPassword,
  resetPassword,
  verifyEmail,
  generateNewAccessToken,
  logOut,
  readSession,
};
