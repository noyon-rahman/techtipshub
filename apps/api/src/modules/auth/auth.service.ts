import httpStatus from "http-status";
import jwt, { JwtPayload } from "jsonwebtoken";
import config from "../../config";
import { AppError } from "../../errors";
import {
  generateResetPasswordEmail,
  generateVerifyEmail,
  isEmailConfigured,
  sendEmail,
} from "../../utils";
import { IUser } from "../user/user.interface";
import type { IGoogleProfile } from "./google-oauth";
import User from "../user/user.model";

const register = async (payload: IUser) => {
  const existedEmail = await User.findOne({
    email: payload.email,
  })
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

  const newUser = await User.create(payload);

  const jwtPayload = {
    email: newUser.email,
    role: newUser.role,
  };

  const verifyToken = User.createToken(
    jwtPayload,
    config.JWT_RESET_PASSWORD_SECRET,
    config.JWT_RESET_PASSWORD_EXPIRES_IN,
  );

  const verifyEmailLink = `${config.API_BASE_URL}/auth/verify-email?email=${newUser?.email}&token=${verifyToken}`;

  // send verify email link
  await sendEmail({
    to: {
      name: newUser.fullName,
      address: newUser.email,
    },
    subject: "Verify your email address with 24 hours",
    text: "Please verify your email address with 24 hours",
    html: generateVerifyEmail({
      verifyEmailLink: verifyEmailLink,
      fullName: newUser.fullName,
    }),
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
  const user = await User.findOne({ email: payload.email }).select("+password");

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
 * Refused: a soft-deleted account, a blocked one, and a Google id that is
 * already attached to a *different* account. That last one is the account
 * takeover attempt Google's id exists to catch: it means a second address now
 * signed in as a Google user this site already knows.
 */
const googleLogin = async (profile: IGoogleProfile) => {
  const byGoogleId = await User.findOne({ googleId: profile.sub }).setOptions({
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
  if (byGoogleId && byGoogleId.email.toLowerCase() !== profile.email.toLowerCase()) {
    throw new AppError(
      httpStatus.CONFLICT,
      "This Google account is already linked to a different TechTipsHub account.",
    );
  }

  const byEmail = await User.findOne({ email: profile.email }).setOptions({
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
      username: await uniqueUsername(usernameBase(profile)),
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

/** `ada.lovelace@example.com` reads as `adalovelace`, never as an empty name. */
const usernameBase = (profile: IGoogleProfile) => {
  const fromEmail = profile.email.split("@")[0].toLowerCase().replace(/\W/g, "");

  return fromEmail || "reader";
};

/**
 * A username nobody holds yet.
 *
 * The schema requires one and the existing social sign-in built it from the
 * full name, which collides for two people called the same. A numeric suffix
 * keeps it readable until the reader changes it in settings.
 */
const uniqueUsername = async (base: string) => {
  let candidate = base;
  let suffix = 1;

  while (await User.exists({ username: candidate })) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }

  return candidate;
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
    "+password",
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
  const user = await User.findOne({ email });
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

  await sendEmail({
    to: {
      name: user.fullName,
      address: user.email,
    },
    subject: "Reset Your Password within 30 minutes",
    text: "Reset Your Password within 30 minutes",
    html: generateResetPasswordEmail({
      resetPasswordLink: resetUILink,
      fullName: user.fullName,
    }),
    // A reset mail that fails to send must not be reported as sent.
    throwOnError: true,
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
  // clearly. The account comes from the token itself — never from a field the
  // caller can edit — so a valid link can only ever reset its own account.
  let decoded: JwtPayload;
  try {
    decoded = User.verifyToken(
      token,
      config.JWT_RESET_PASSWORD_SECRET,
    ) as JwtPayload;
  } catch (error: any) {
    const message =
      error?.name === "TokenExpiredError"
        ? "This reset link has expired. Request a new one."
        : "This reset link is not valid. Request a new one.";
    throw new AppError(httpStatus.FORBIDDEN, message);
  }

  const user = await User.findOne({ email: decoded.email });
  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
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
    throw new AppError(httpStatus.UNAUTHORIZED, "Session expired. Sign in again.");
  }

  const user = await User.findOne({ email: decoded.email });
  if (!user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Session expired. Sign in again.");
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
    throw new AppError(httpStatus.UNAUTHORIZED, "Session ended. Sign in again.");
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

    await User.updateOne(
      { _id: user._id },
      { $inc: { tokenVersion: 1 } },
    );
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
}) => ({
  _id: String(user._id),
  email: user.email,
  name: user.fullName,
  username: user.username,
  profilePicture: user.profilePicture ?? "",
  role: user.role,
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
            "email fullName username profilePicture role tokenVersion status isDeleted",
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

export const authService = {
  register,
  login,
  googleLogin,
  getMe,
  changePassword,
  forgetPassword,
  resetPassword,
  generateNewAccessToken,
  logOut,
  readSession,
};
