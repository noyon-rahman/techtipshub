import { JwtPayload } from "jsonwebtoken";
import { Document, Model } from "mongoose";

export type TUserRole = "User" | "Admin";
export type TUserStatus = "Active" | "Blocked";
export type TUserGender = "Male" | "Female" | "Other";
export type TSocialPlatform =
  "Facebook" | "Instagram" | "Linkedin" | "Twitter" | "Github" | "Youtube";

export type TSocialLink = {
  platform: TSocialPlatform;
  url: string;
};

/**
 * A handle some member used to hold.
 *
 * Stored in its own collection rather than on the member, because the question
 * "is this handle free?" is answered against everyone's history at once, and a
 * handle has to stay reserved after the account that held it is deleted.
 */
export interface IUsernameHistoryEntry extends Document {
  username: string;
  /** The account that held it, kept for the admin trail only. */
  userId: string;
  /** From here on the handle can be claimed, and its redirect stops. */
  reservedUntil: Date;
}

export interface IUser extends Document {
  fullName: string;
  username: string;
  bio: string;
  designation: string;
  email: string;
  phone: string;
  gender: TUserGender;
  password: string;
  passwordChangeAt?: Date;
  profilePicture: string;
  role: TUserRole;
  status: TUserStatus;
  totalFollowers: number;
  totalFollowing: number;
  /** Stored DB field name for the user's blog count. */
  totalPosts: number;
  /** Virtual alias of `totalPosts` exposed by the API. */
  totalBlogs: number;
  socialLinks: TSocialLink[];
  /**
   * The categories the reader wants to read, as category ids.
   *
   * Stored on the account rather than inferred from reading history, so it is
   * one cheap field to read and the reader can see and change it.
   */
  interests: string[];
  /**
   * When the reader answered the interests step, with a choice or a skip.
   *
   * A date rather than a flag so the step can also be offered to an account
   * that answered, the next time it changes. `undefined` means never asked.
   */
  interestsAnsweredAt?: Date;
  /**
   * When the member confirmed their handle after a first sign-in.
   *
   * A date rather than a flag so an older account that never met the step can
   * be marked with the day it was added, and so the value says when rather than
   * only whether. `undefined` means the step has never been answered.
   */
  usernameOnboardedAt?: Date;
  /**
   * When the current handle was chosen.
   *
   * The lock is this date plus a fixed window, computed where it is enforced
   * rather than stored, so changing the window is one constant. Absent on an
   * account whose handle has never changed, which is free to change once.
   */
  usernameChangedAt?: Date;
  location: string;
  dateOfBirth: Date;
  isVerified: boolean;
  /** Google's stable account id, set on the first Google sign-in. */
  googleId?: string;
  /** Raised to end every session this account has. See the model. */
  tokenVersion: number;
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserModel extends Model<IUser> {
  generateHashPassword(
    plainTextPassword: string,
    saltRound?: number,
  ): Promise<string>;

  isPasswordMatch(
    plainTextPassword: string,
    hashedPassword: string,
  ): Promise<boolean>;

  createToken(
    jwtPayload: JwtPayload,
    secret: string,
    expiresIn: string,
  ): string;

  verifyToken(token: string, secret: string): JwtPayload;

  isJWTIssuedBeforePasswordChanged(
    passwordChangedTimestamp: Date,
    jwtIssuedTimestamp: number,
  ): boolean;
}
