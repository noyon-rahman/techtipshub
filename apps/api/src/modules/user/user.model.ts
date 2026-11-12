import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { model, Schema } from "mongoose";
import config from "../../config";
import {
  SocialPlatform,
  UserGender,
  UserRoles,
  UserStatus,
} from "./user.constant";
import { IUser, IUserModel, TSocialLink } from "./user.interface";

const socialLinksSchema = new Schema<TSocialLink>(
  {
    platform: {
      type: String,
      enum: {
        values: SocialPlatform,
        message: "{VALUE} is not a valid social platform",
      },
    },
    url: {
      type: String,
      required: [true, "Url is required"],
    },
  },
  { _id: false },
);

const userSchema = new Schema<IUser, IUserModel>(
  {
    fullName: {
      type: String,
      trim: true,
      required: [true, "Full Name is required"],
    },
    username: {
      type: String,
      trim: true,
      required: [true, "Username is required"],
      unique: true,
    },
    bio: {
      type: String,
      default: "",
    },
    designation: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      required: [true, "Email is required"],
      unique: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    location: {
      type: String,
      default: "",
    },
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters"],
      select: 0,
    },
    passwordChangeAt: {
      type: Date,
    },
    profilePicture: {
      type: String,
      default: "",
    },
    gender: {
      type: String,
      enum: {
        values: UserGender,
        message: "{VALUE} is not a valid gender",
      },
    },
    role: {
      type: String,
      enum: {
        values: UserRoles,
        message: "{VALUE} is not a valid role",
      },
      default: "User",
    },
    status: {
      type: String,
      enum: {
        values: UserStatus,
        message: "{VALUE} is not a valid status",
      },
      default: "Active",
    },
    totalFollowers: {
      type: Number,
      default: 0,
    },
    totalFollowing: {
      type: Number,
      default: 0,
    },
    // Stored as `totalPosts` for database compatibility; exposed as `totalBlogs`.
    totalPosts: {
      type: Number,
      default: 0,
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    socialLinks: {
      type: [socialLinksSchema],
      default: [],
    },
    // Category ids the reader picked as interests. Strings, so the value a
    // reader saves is the same value the feed compares against; an id that no
    // longer names a live category is skipped at read time, not deleted here.
    interests: {
      type: [String],
      default: [],
    },
    // Absent on every account that has never been asked (all of the older
    // ones), which is what makes the onboarding step show for them.
    interestsAnsweredAt: {
      type: Date,
    },
    // Absent on every account that has never confirmed a handle, which is what
    // makes the step show for them. Filled for existing members by the
    // backfill in `username-history.backfill.ts`, so nobody is sent back to a
    // step they never had.
    usernameOnboardedAt: {
      type: Date,
    },
    // Absent until the handle is actually changed. The lock is computed from
    // it, never stored, so only the moment of the change is a fact.
    usernameChangedAt: {
      type: Date,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    /**
     * Bumped to end every session this account has.
     *
     * Both tokens carry the value they were signed with, so raising it makes
     * every token issued before that moment invalid at its next check. That is
     * what makes "sign out everywhere", a password change and a password reset
     * actually end a stolen refresh token, which a stateless JWT otherwise
     * cannot do.
     */
    tokenVersion: {
      type: Number,
      default: 0,
    },
    // Google's stable account id. Set the first time a member signs in with
    // Google, so later sign-ins are matched to the person, not just the
    // address: a recycled mailbox is a different Google account.
    googleId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.isDeleted;
        delete ret.isPremiumUser;
        return ret;
      },
    },
  },
);

// The field is stored as `totalPosts` so existing documents keep working, but
// the API speaks `totalBlogs` and the client reads that name.
userSchema.virtual("totalBlogs").get(function () {
  return this.totalPosts;
});

userSchema.pre("find", function (next) {
  if (!this.getOptions()?.bypassMiddleware) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

userSchema.pre("findOne", function (next) {
  if (!this.getOptions()?.bypassMiddleware) {
    this.find({ isDeleted: { $ne: true } });
  }
  next();
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  this.password = await bcrypt.hash(this.password, config.BCRYPT_SALT_ROUND);
  next();
});

userSchema.post("save", function (doc, next) {
  doc.password = "";
  next();
});

userSchema.statics.isPasswordMatch = function (
  plainTextPassword: string,
  hashedPassword,
) {
  return bcrypt.compare(plainTextPassword, hashedPassword);
};

userSchema.statics.generateHashPassword = async function (
  plainTextPassword: string,
) {
  return await bcrypt.hash(plainTextPassword, config.BCRYPT_SALT_ROUND);
};

userSchema.statics.createToken = function (
  jwtPayload: { email: string; role: string },
  secret: string,
  expiresIn: string,
) {
  return jwt.sign(jwtPayload, secret, {
    // expiresIn comes from env vars, which are typed as plain `string`;
    // jsonwebtoken's SignOptions wants the `ms` StringValue union ("15m", "7d").
    expiresIn: expiresIn as SignOptions["expiresIn"],
  });
};

userSchema.statics.verifyToken = function (token: string, secret: string) {
  return jwt.verify(token, secret);
};

userSchema.statics.isJWTIssuedBeforePasswordChanged = function (
  passwordChangedTimestamp: Date,
  jwtIssuedTimestamp: number,
) {
  const passwordChangedTime =
    new Date(passwordChangedTimestamp).getTime() / 1000;
  return passwordChangedTime > jwtIssuedTimestamp;
};

// The third argument pins the stored name, so it does not follow a future
// rename of the model.
const User = model<IUser, IUserModel>("User", userSchema, "users");
export default User;
