/**
 * The session and user contract lives in `@techtipshub/shared` so the API and
 * the site cannot disagree about it. Re-exported here because almost every
 * screen imports from `@/types`.
 */
export type {
  ILoggedInUser,
  ILoggedInUser as TLoggedInUser,
  IUser,
  TSocialLink,
  TSocialPlatform,
  TUserGender,
  TUserRole,
  TUserStatus,
} from "@techtipshub/shared";
