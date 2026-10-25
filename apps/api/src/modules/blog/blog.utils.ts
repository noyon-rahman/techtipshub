import slugify from "slugify";
import Blog from "./blog.model";

export const generateUniqueSlug = async (title: string) => {
  const baseSlug = slugify(`${title}`, {
    lower: true,
    trim: true,
    remove: /[*+~.()'"!?:@#$%^&\\]/g,
    replacement: "-",
  });

  let slug = baseSlug;
  let suffix = 1;

  while (await Blog.findOne({ slug })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return slug;
};
