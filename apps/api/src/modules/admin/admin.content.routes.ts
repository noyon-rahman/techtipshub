import { Hono } from "hono";
import type { TAppBindings } from "../../interface/bindings";
import { validate, withUploads } from "../../middlewares";
import { blogValidationSchema } from "../blog/blog.validation";
import { blogController } from "../blog/blog.controller";
import { categoryController } from "../category/category.controller";
import { categoryValidationSchema } from "../category/category.validation";

/**
 * Body parsing for admin blog writes.
 *
 * `coverImage` is only replaced when a file actually arrives, so a JSON update
 * that carries no image keeps the stored one.
 */
const adminBlogRouter = new Hono<TAppBindings>();

adminBlogRouter.get("/", blogController.getAdminList);

adminBlogRouter.get("/trash", blogController.getDeletedBlogs);

adminBlogRouter.patch("/:id/restore", blogController.restoreBlog);

adminBlogRouter.delete("/:id", blogController.deleteBlogByAdminUsingId);

adminBlogRouter.put(
  "/:id",
  withUploads({ field: "image", target: "coverImage" }),
  validate({ json: blogValidationSchema.updateByAdmin }),
  blogController.updateBlogByAdmin,
);

const adminCategoryRouter = new Hono<TAppBindings>();

adminCategoryRouter.get("/", categoryController.getAdminList);

adminCategoryRouter.post(
  "/",
  validate({ json: categoryValidationSchema.create }),
  categoryController.create,
);

adminCategoryRouter.patch(
  "/:id",
  validate({ json: categoryValidationSchema.update }),
  categoryController.update,
);

adminCategoryRouter.delete(
  "/:id",
  validate({ json: categoryValidationSchema.deleteCategory }),
  categoryController.deleteSingleCategory,
);

export { adminBlogRouter, adminCategoryRouter };
