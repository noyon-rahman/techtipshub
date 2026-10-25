import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth, validateRequest, withUploads } from "../../middlewares";
import { userController } from "./user.controller";
import { userValidationSchema } from "./user.validation";

const userRouter = new Hono<TAppBindings>();

// Literal paths must stay above "/:username", or they are read as a username.
userRouter.patch(
  "/update-profile",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  withUploads({ field: "image", target: "profilePicture", resourceType: "auto" }),
  validateRequest(userValidationSchema.updateProfile),
  userController.updateProfile,
);

userRouter.put(
  "/profile/update-social-links",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  validateRequest(userValidationSchema.updateSocialLinks),
  userController.updateSocialLinks,
);

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

// follow a user (id: indicates that the user wanted to follow)
userRouter.put("/:id/follow", auth(USER_ROLE.USER), userController.followUser);

// unfollow a user (id: indicates that the user wanted to unfollow)
userRouter.delete("/:id/unfollow", auth(USER_ROLE.USER), userController.unfollowUser);

// check the follow status
userRouter.get("/:id/follow-status", auth(USER_ROLE.USER), userController.getFollowStatus);

// get all followers by user id
userRouter.get("/:id/followers", userController.getFollowersByUserId);

// get all following by user id
userRouter.get("/:id/following", userController.getFollowingByUserId);

// get user details by username. Kept last so it cannot swallow the paths above.
userRouter.get("/:username", userController.getSingleUserByUsername);

export default userRouter;
