import slugify from "slugify";
import Blog from "./blog.model";

const SLUG_OPTIONS = {
  lower: true,
  trim: true,
  remove: /[*+~.()'"!?:@#$%^&\\]/g,
  replacement: "-",
};

/** The address form the API stores, from whatever an editor typed. */
export const toSlug = (value: string) => slugify(`${value}`, SLUG_OPTIONS);

// `excludeId` is the article being edited: its own slug is not a collision.
export const generateUniqueSlug = async (title: string, excludeId?: string) => {
  const baseSlug = toSlug(title);

  let slug = baseSlug;
  let suffix = 1;

  while (
    await Blog.findOne({
      slug,
      // Rebuilt every pass: the candidate changes, the exclusion does not.
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
      // A trashed article still holds its slug against the unique index.
      .setOptions({ bypassMiddleware: true })
  ) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
};
