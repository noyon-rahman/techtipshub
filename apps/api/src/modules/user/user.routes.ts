import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth, validate, withUploads } from "../../middlewares";
import { userController } from "./user.controller";
import { userValidationSchema } from "./user.validation";
import { usernameValidationSchema } from "./username.validation";

const userRouter = new Hono<TAppBindings>();

// Literal paths must stay above "/:username", or they are read as a username.
userRouter.patch(
  "/update-profile",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  withUploads({
    field: "image",
    target: "profilePicture",
    resourceType: "auto",
  }),
  validate({ json: userValidationSchema.updateProfile }),
  userController.updateProfile,
);

userRouter.put(
  "/profile/update-social-links",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validate({ json: userValidationSchema.updateSocialLinks }),
  userController.updateSocialLinks,
);

// The reader's interests, answered from the token rather than an id the site
// would have to hold. Both are open to an admin too: an admin reads articles.
userRouter.get(
  "/interests",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  userController.getInterests,
);

userRouter.put(
  "/interests",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validate({ json: userValidationSchema.updateInterests }),
  userController.updateInterests,
);

/**
 * The username step. Its own paths rather than a wider profile update, so the
 * one-time decision is recorded by an endpoint that can only do that, and the
 * availability answer a form asks for every few keystrokes is a read.
 */
userRouter.get(
  "/username/onboarding",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  userController.readUsernameOnboarding,
);

userRouter.post(
  "/username/onboarding",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validate({ json: usernameValidationSchema.completeUsernameOnboarding }),
  userController.completeUsernameOnboarding,
);

userRouter.get(
  "/username/availability",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validate({ query: usernameValidationSchema.checkUsernameAvailability }),
  userController.checkUsernameAvailability,
);

userRouter.get(
  "/username/state",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  userController.getUsernameState,
);

// Public on purpose: the caller is a crawler or a reader following a saved
// link, and neither holds a session.
userRouter.get("/username/current/:handle", userController.findCurrentHandle);

userRouter.get(
  "/my-followers",
  auth(USER_ROLE.USER),
  userController.getLoggedInUserFollowers,
);

userRouter.get(
  "/my-following",
  auth(USER_ROLE.USER),
  userController.getLoggedInUserFollowing,
);

userRouter.put("/:id/follow", auth(USER_ROLE.USER), userController.followUser);

userRouter.delete(
  "/:id/unfollow",
  auth(USER_ROLE.USER),
  userController.unfollowUser,
);

userRouter.get(
  "/:id/follow-status",
  auth(USER_ROLE.USER),
  userController.getFollowStatus,
);

userRouter.get("/:id/followers", userController.getFollowersByUserId);

userRouter.get("/:id/following", userController.getFollowingByUserId);

// get user details by username. Kept last so it cannot swallow the paths above.
userRouter.get("/:username", userController.getSingleUserByUsername);

export default userRouter;
