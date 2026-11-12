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

// The admin composer: an article written for a member, live or as a draft.
adminBlogRouter.post(
  "/",
  withUploads({ field: "image", target: "coverImage" }),
  validate({ json: blogValidationSchema.createByAdmin }),
  blogController.createByAdmin,
);

adminBlogRouter.get("/trash", blogController.getDeletedBlogs);

// Literal before "/:id", and parsed as JSON: a selection is a list, not a file.
adminBlogRouter.post(
  "/trash/permanent",
  validate({ json: categoryValidationSchema.bulkDelete }),
  blogController.deleteBlogsPermanently,
);

adminBlogRouter.post(
  "/bulk-delete",
  validate({ json: categoryValidationSchema.bulkDelete }),
  blogController.deleteBlogsInBulk,
);

// Takes a draft live. The only status transition an article has.
adminBlogRouter.patch("/:id/publish", blogController.publishBlog);

adminBlogRouter.get("/:id", blogController.getAdminSingle);

adminBlogRouter.patch("/:id/restore", blogController.restoreBlog);

adminBlogRouter.delete("/:id/permanent", blogController.deleteBlogPermanently);

adminBlogRouter.delete("/:id", blogController.deleteBlogByAdminUsingId);

adminBlogRouter.put(
  "/:id",
  withUploads({ field: "image", target: "coverImage" }),
  validate({ json: blogValidationSchema.updateByAdmin }),
  blogController.updateBlogByAdmin,
);

const adminCategoryRouter = new Hono<TAppBindings>();

adminCategoryRouter.get("/", categoryController.getAdminList);

// Literal paths before "/:id": the router matches in order.
adminCategoryRouter.get("/trash", categoryController.getDeletedCategories);

adminCategoryRouter.post(
  "/bulk-delete",
  validate({ json: categoryValidationSchema.bulkDelete }),
  categoryController.deleteCategoriesInBulk,
);

adminCategoryRouter.post(
  "/",
  validate({ json: categoryValidationSchema.create }),
  categoryController.create,
);

adminCategoryRouter.patch("/:id/restore", categoryController.restoreCategory);

adminCategoryRouter.delete(
  "/:id/permanent",
  categoryController.deleteCategoryPermanently,
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
