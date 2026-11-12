import httpStatus from "http-status";
import mongoose from "mongoose";
import { escapeRegex, parseSearchTerms, QueryBuilder } from "../../builder";
import { AppError } from "../../errors";
import { adminLogService } from "../admin/admin-log.service";
import Blog from "../blog/blog.model";
import { categorySearchableFields } from "./category.constant";
import Category from "./category.model";

type TCategoryInput = {
  name?: string;
  description?: string;
};

// Names are compared case-insensitively: "React" and "react" are one category.
const findByName = (name: string, excludeId?: string) =>
  Category.findOne({
    name: {
      $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`,
      $options: "i",
    },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });

const create = async (payload: TCategoryInput, adminEmail?: string) => {
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  if (!name) {
    throw new AppError(httpStatus.BAD_REQUEST, "Category name is required");
  }

  if (await findByName(name)) {
    throw new AppError(httpStatus.CONFLICT, "Category already exists");
  }

  const category = await Category.create({
    name,
    description:
      typeof payload.description === "string" ? payload.description.trim() : "",
    postCount: 0,
  });

  await adminLogService.record({
    adminEmail,
    action: "category.create",
    targetType: "category",
    targetId: String(category._id),
    summary: `Created category "${category.name}"`,
  });

  return category;
};

/**
 * A signed-in member naming a category while writing an article.
 *
 * The same create the admin screen makes, so one duplicate check and one shape
 * apply to both. It writes no activity-log row: that feed is the admins' own
 * record, and a member's name under an admin action would muddy it.
 *
 * The refusal for a name already in use (409) reaches the caller as an error,
 * which the composer shows on the field it was typed into.
 */
const createByAuthor = async (payload: TCategoryInput) => {
  const category = await create(payload);

  return category.toJSON();
};

/**
 * How many published articles each category holds, by category id.
 *
 * Counted from the articles rather than read from the stored `postCount`: the
 * counter only moves when an article is created, published, deleted or moved,
 * so a row written before that bookkeeping (or by a direct edit) drifts, and a
 * reader would be sent to a category page that lists a different number.
 */
const countBlogsByCategory = async () => {
  // Deleted blogs and drafts are excluded so the count matches what readers see.
  const counts = await Blog.aggregate<{
    _id: mongoose.Types.ObjectId;
    count: number;
  }>([
    {
      $match: {
        isDeleted: { $ne: true },
        status: { $ne: "draft" },
      },
    },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);

  return new Map(counts.map((row) => [String(row._id), row.count]));
};

const getAll = async (query: Record<string, unknown>) => {
  const categoryQuery = new QueryBuilder(Category.find({}), query).search(
    categorySearchableFields,
  );

  await categoryQuery.filter();

  categoryQuery.sort().paginate().fields();

  const [result, meta, countByCategory] = await Promise.all([
    categoryQuery.modelQuery,
    categoryQuery.countTotal(),
    countBlogsByCategory(),
  ]);

  return {
    result: result.map((category) => ({
      ...category.toJSON(),
      blogCount: countByCategory.get(String(category._id)) ?? 0,
    })),
    meta,
  };
};

const getSingleCategory = async (id: string) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  return category;
};

/**
 * A category in use by a live article cannot leave the admin list: the
 * article's own page and every composer would point at it. Drafts do not
 * count, because they are not readable yet and can be re-filed.
 */
const publishedCount = (categoryId: string) =>
  Blog.countDocuments({
    category: categoryId,
    isDeleted: { $ne: true },
    status: { $ne: "draft" },
  });

const deleteSingleCategory = async (id: string, adminEmail?: string) => {
  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  const blogCount = await publishedCount(String(category._id));
  if (blogCount > 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Category still has ${blogCount} published blogs. Move or delete them first.`,
    );
  }

  category.isDeleted = true;
  const result = await category.save();

  await adminLogService.record({
    adminEmail,
    action: "category.delete",
    targetType: "category",
    targetId: String(category._id),
    summary: `Deleted category "${category.name}"`,
  });

  return result;
};

/**
 * Move several categories to the trash in one step.
 *
 * All or nothing on purpose: a half-applied selection would leave the admin
 * guessing which rows were actually removed. A category still holding a
 * published article refuses the whole selection and names it, so the admin can
 * clear that row first.
 */
const deleteCategoriesInBulk = async (ids: string[], adminEmail?: string) => {
  const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));
  const categories = await Category.find({ _id: { $in: objectIds } }).select(
    "name",
  );

  if (categories.length !== ids.length) {
    throw new AppError(httpStatus.NOT_FOUND, "Some categories were not found");
  }

  const inUse = await Promise.all(
    categories.map(async (category) => ({
      name: category.name,
      count: await publishedCount(String(category._id)),
    })),
  );
  const blocked = inUse.filter((row) => row.count > 0);
  if (blocked.length > 0) {
    const names = blocked.map((row) => `"${row.name}"`).join(", ");
    throw new AppError(
      httpStatus.CONFLICT,
      `${names} still has published blogs. Move or delete them first.`,
    );
  }

  await Category.updateMany(
    { _id: { $in: objectIds } },
    { isDeleted: true },
    { runValidators: true },
  );

  await adminLogService.record({
    adminEmail,
    action: "category.delete",
    targetType: "category",
    targetId: ids[0],
    summary:
      categories.length === 1
        ? `Deleted category "${categories[0].name}"`
        : `Deleted ${categories.length} categories`,
    meta: {
      count: categories.length,
      names: categories.map((category) => category.name),
    },
  });

  return { deleted: categories.length };
};

/**
 * The trashed categories, for Trash.
 *
 * The find hook hides deleted rows, so this is the one place that asks for
 * them by setting `bypassMiddleware`, the same way the article and member
 * trash lists do.
 */
const getDeletedCategories = async (query: Record<string, unknown> = {}) => {
  const terms = parseSearchTerms(query.searchTerm);
  const search = terms.length
    ? {
        $and: terms.map((term) => {
          const escaped = escapeRegex(term);
          return {
            name: {
              $regex: escaped.length >= 3 ? `^${escaped}` : escaped,
              $options: "i",
            },
          };
        }),
      }
    : {};

  const categories = await Category.find({ ...search, isDeleted: true })
    .setOptions({ bypassMiddleware: true })
    .sort({ updatedAt: -1, _id: -1 });

  const countByCategory = await countBlogsByCategory();

  return {
    result: categories.map((category) => ({
      _id: category._id,
      name: category.name,
      description: category.description ?? "",
      blogCount: countByCategory.get(String(category._id)) ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    })),
  };
};

const restoreCategory = async (id: string, adminEmail?: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid category Id");
  }

  const raw = await Category.collection.findOne({
    _id: new mongoose.Types.ObjectId(id),
  });
  if (!raw) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  // Another category may have taken the name while this one sat in the trash.
  const taken = await findByName(raw.name, id);
  if (taken) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Another category is already named "${raw.name}". Rename it first.`,
    );
  }

  const result = await Category.findByIdAndUpdate(
    id,
    { isDeleted: false },
    { new: true, runValidators: true },
  );

  await adminLogService.record({
    adminEmail,
    action: "category.restore",
    targetType: "category",
    targetId: id,
    summary: `Restored category "${raw.name}"`,
  });

  return result;
};

/**
 * Erase a trashed category for good.
 *
 * Only a trashed one can go, so the empty check already passed on the way in;
 * it is asked again because an article could have been re-filed under it from
 * the trash's own lists in the meantime.
 */
const deleteCategoryPermanently = async (id: string, adminEmail?: string) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new AppError(httpStatus.BAD_REQUEST, "Invalid category Id");
  }

  const raw = await Category.collection.findOne({
    _id: new mongoose.Types.ObjectId(id),
  });
  if (!raw) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  if (raw.isDeleted !== true) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      "Move the category to the trash before deleting it permanently",
    );
  }

  const blogCount = await Blog.countDocuments({ category: raw._id });
  if (blogCount > 0) {
    throw new AppError(
      httpStatus.CONFLICT,
      `Category still has ${blogCount} blogs, drafts included. Move them first.`,
    );
  }

  await Category.deleteOne({ _id: raw._id });

  await adminLogService.record({
    adminEmail,
    action: "category.delete_permanent",
    targetType: "category",
    targetId: id,
    summary: `Permanently deleted category "${raw.name}"`,
  });

  return { _id: id, name: raw.name };
};

const update = async (
  id: string,
  payload: TCategoryInput,
  adminEmail?: string,
) => {
  const updatePayload: Partial<TCategoryInput> = {};

  if (payload.name !== undefined) {
    updatePayload.name = payload.name.trim();
    if (!updatePayload.name) {
      throw new AppError(httpStatus.BAD_REQUEST, "Category name is required");
    }
  }

  if (payload.description !== undefined) {
    updatePayload.description = payload.description.trim();
  }

  const category = await Category.findById(id);
  if (!category) {
    throw new AppError(httpStatus.NOT_FOUND, "Category not found");
  }

  if (
    updatePayload.name &&
    (await findByName(updatePayload.name, String(category._id)))
  ) {
    throw new AppError(httpStatus.CONFLICT, "Category already exists");
  }

  const updated = await Category.findByIdAndUpdate(id, updatePayload, {
    new: true,
    runValidators: true,
  });

  await adminLogService.record({
    adminEmail,
    action: "category.update",
    targetType: "category",
    targetId: String(category._id),
    summary: `Updated category "${updated?.name ?? category.name}"`,
    meta: updatePayload,
  });

  return updated;
};

const getAdminList = async (query: Record<string, unknown> = {}) => {
  // Whitelisted and regex-escaped: `searchTerm` is expanded here, never
  // spliced into a Mongo filter as it arrived.
  const terms = parseSearchTerms(query.searchTerm);
  const search = terms.length
    ? {
        $and: terms.map((term) => {
          const escaped = escapeRegex(term);
          return {
            name: {
              $regex: escaped.length >= 3 ? `^${escaped}` : escaped,
              $options: "i",
            },
          };
        }),
      }
    : {};

  const categories = await Category.find(search).sort({ name: 1 });
  const countByCategory = await countBlogsByCategory();

  const rows = categories
    .map((category) => ({
      _id: category._id,
      name: category.name,
      description: category.description ?? "",
      blogCount: countByCategory.get(String(category._id)) ?? 0,
      createdAt: category.createdAt,
      updatedAt: category.updatedAt,
    }))
    .sort((a, b) => b.blogCount - a.blogCount || a.name.localeCompare(b.name));

  // Paging is opt-in: with neither `page` nor `limit` the whole list comes back
  // (the table is small), and `total` stays the number of matching categories.
  const rawPage = Math.trunc(Number(query.page));
  const rawLimit = Math.trunc(Number(query.limit));
  const total = rows.length;

  if (!(rawPage > 0) && !(rawLimit > 0)) {
    return { result: rows, total };
  }

  const page = Math.max(1, rawPage || 1);
  const limit = rawLimit > 0 ? Math.min(100, rawLimit) : 50;
  const start = (page - 1) * limit;

  return {
    result: rows.slice(start, start + limit),
    total,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const categoryService = {
  create,
  createByAuthor,
  getAll,
  getSingleCategory,
  deleteSingleCategory,
  deleteCategoriesInBulk,
  getDeletedCategories,
  restoreCategory,
  deleteCategoryPermanently,
  update,
  getAdminList,
  findByName,
};
