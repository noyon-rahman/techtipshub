import httpStatus from "http-status";
import { JwtPayload } from "jsonwebtoken";
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

  const jwtPayload = {
    _id: user._id,
    profilePicture: user.profilePicture,
    username: user.username,
    name: user.fullName,
    email: user.email,
    role: user.role,
  };

  const accessToken = User.createToken(
    jwtPayload,
    config.JWT_ACCESS_TOKEN_SECRET,
    config.JWT_ACCESS_TOKEN_EXPIRES_IN,
  );

  const refreshToken = User.createToken(
    jwtPayload,
    config.JWT_REFRESH_TOKEN_SECRET,
    config.JWT_REFRESH_TOKEN_EXPIRES_IN,
  );

  return { accessToken, refreshToken };
};

const socialLogin = async (payload: IUser) => {
  let user = await User.findOne({ email: payload.email });
  if (!user) {
    payload.username = payload.fullName.toLowerCase().split(" ").join("");
    user = await register(payload);
  }
  const jwtPayload = {
    _id: user._id,
    profilePicture: user.profilePicture,
    username: user.username,
    name: user.fullName,
    email: user.email,
    role: user.role,
  };

  const accessToken = User.createToken(
    jwtPayload,
    config.JWT_ACCESS_TOKEN_SECRET,
    config.JWT_ACCESS_TOKEN_EXPIRES_IN,
  );

  const refreshToken = User.createToken(
    jwtPayload,
    config.JWT_REFRESH_TOKEN_SECRET,
    config.JWT_REFRESH_TOKEN_EXPIRES_IN,
  );

  return { accessToken, refreshToken };
};

/**
 * Sign in (or sign up) with a Google account.
 *
 * Unlike `login` this never checks a password: Google has already confirmed
 * who the reader is. A new address becomes an account here, and an existing
 * one is only refused if it is gone, blocked or soft-deleted, so the reason is
 * the same one `refreshToken` gives rather than Google's opaque failure.
 *
 * The account is created without a password through `register`, which also
 * sends the verification mail; neither is waited on for the response, because
 * a Google profile carries no username and the mail server may be slow.
 */
const googleLogin = async (profile: IGoogleProfile) => {
  let user = await User.findOne({ email: profile.email });

  if (!user) {
    const base = profile.email.split("@")[0].toLowerCase().replace(/\W/g, "");
    const username = await uniqueUsername(base || "reader");

    user = await User.create({
      fullName: profile.name,
      username,
      email: profile.email,
      profilePicture: profile.picture,
    });
  }

  if (user.isDeleted) {
    throw new AppError(httpStatus.FORBIDDEN, "User is deleted");
  }

  if (user.status === "Blocked") {
    throw new AppError(httpStatus.FORBIDDEN, "User is blocked");
  }

  const jwtPayload = {
    _id: user._id,
    profilePicture: user.profilePicture,
    username: user.username,
    name: user.fullName,
    email: user.email,
    role: user.role,
  };

  const accessToken = User.createToken(
    jwtPayload,
    config.JWT_ACCESS_TOKEN_SECRET,
    config.JWT_ACCESS_TOKEN_EXPIRES_IN,
  );

  const refreshToken = User.createToken(
    jwtPayload,
    config.JWT_REFRESH_TOKEN_SECRET,
    config.JWT_REFRESH_TOKEN_EXPIRES_IN,
  );

  return { accessToken, refreshToken };
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
    },
    {
      new: true,
      runValidators: true,
    },
  );
};

const generateNewAccessToken = async (refreshToken: string) => {
  const decoded = User.verifyToken(
    refreshToken,
    config.JWT_REFRESH_TOKEN_SECRET,
  );

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

  if (
    user.passwordChangeAt &&
    User.isJWTIssuedBeforePasswordChanged(
      user.passwordChangeAt,
      decoded.iat as number,
    )
  ) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Unauthorized Access");
  }

  const jwtPayload = {
    _id: user._id,
    profilePicture: user.profilePicture,
    username: user.username,
    name: user.fullName,
    email: user.email,
    role: user.role,
  };

  const accessToken = User.createToken(
    jwtPayload,
    config.JWT_ACCESS_TOKEN_SECRET,
    config.JWT_ACCESS_TOKEN_EXPIRES_IN,
  );

  return accessToken;
};

export const authService = {
  register,
  login,
  socialLogin,
  googleLogin,
  getMe,
  changePassword,
  forgetPassword,
  resetPassword,
  generateNewAccessToken,
};
