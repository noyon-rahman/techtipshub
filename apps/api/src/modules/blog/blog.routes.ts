import { Hono } from "hono";
import { USER_ROLE } from "../../constant";
import type { TAppBindings } from "../../interface/bindings";
import { auth, optionalAuth, validateRequest, withUploads } from "../../middlewares";
import { commentValidationSchema } from "../comment/comment.validation";
import { blogController } from "./blog.controller";
import { blogValidationSchema } from "./blog.validation";

const blogRouter = new Hono<TAppBindings>();

// Literal paths are registered before "/:slug", which would otherwise read
// "following-users" as an article slug.
blogRouter.get("/", blogController.getAll);

blogRouter.get("/following-users", auth(USER_ROLE.USER), blogController.getFollowingUsersBlogs);

blogRouter.get(
  "/my-blogs",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  blogController.getLoggedInUserBlogs,
);

blogRouter.get("/users/:userId", blogController.getAllBlogsByUserId);

blogRouter.post(
  "/",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  withUploads({ field: "image", target: "coverImage" }),
  validateRequest(blogValidationSchema.create),
  blogController.create,
);

// get single blog by blog slug (open to everyone; the whole article is returned)
blogRouter.get("/:slug", optionalAuth, blogController.getSingleBlog);

blogRouter.delete("/:id", auth(USER_ROLE.USER), blogController.deleteBlogByUserUsingId);

blogRouter.put(
  "/:id",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  withUploads({ field: "image", target: "coverImage" }),
  validateRequest(blogValidationSchema.update),
  blogController.updateBlogByUserUsingId,
);

blogRouter.put("/:id/vote", auth(USER_ROLE.USER, USER_ROLE.ADMIN), blogController.voteOnBlog);

blogRouter.get("/:id/vote-status", auth(USER_ROLE.USER), blogController.getVoteStatus);

blogRouter.post(
  "/:id/comments",
  auth(USER_ROLE.USER, USER_ROLE.ADMIN),
  withUploads({ field: "images", target: "images", multiple: true }),
  validateRequest(commentValidationSchema.commentOnBlog),
  blogController.commentOnBlog,
);

blogRouter.get("/:id/comments", blogController.getAllCommentsByBlogId);

export default blogRouter;
