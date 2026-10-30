import CategoryButton from "@/components/ui/category-button";
import { categoryPath, categoriesPath, searchPath } from "@/lib/feed-routes";
import type { ICategory } from "@/types";
import Link from "next/link";

/**
 * How many categories the feed shows before it points at the full list.
 * Eight fills the rail's width in about three rows, which is the most a
 * summary card can take before it stops being a summary.
 */
export const FEED_CATEGORY_LIMIT = 8;

/**
 * The categories the feed shows: the ones with the most published articles
 * first, then alphabetical, so a busy category never hides behind an empty
 * one. The API returns the whole list, so the cap is applied here rather than
 * asking for a page the API would answer from the same query.
 */
export const topCategories = (
  categories: ICategory[],
  limit = FEED_CATEGORY_LIMIT,
) =>
  [...categories]
    .filter((category) => !category.isDeleted)
    .sort(
      (a, b) =>
        (b.blogCount ?? 0) - (a.blogCount ?? 0) || a.name.localeCompare(b.name),
    )
    .slice(0, limit);

/** The category's own page, or the search that covers a name without a slug. */
export const browseHref = (category: Pick<ICategory, "name">) => {
  const path = categoryPath(category.name);
  return path === "/" ? searchPath(category.name) : path;
};

/**
 * A category and how many articles are in it. The count is the API's, taken
 * from published articles only, so the number a reader sees is the number of
 * articles they can open.
 */
export const CategoryRow = ({
  category,
  active,
}: {
  category: ICategory;
  active: boolean;
}) => (
  <li>
    <Link
      href={browseHref(category)}
      aria-current={active ? "page" : undefined}
      className={`-mx-2 flex items-baseline gap-3 rounded-[6px] px-2 py-1.5 text-sm transition-colors hover:bg-default-100 ${
        active
          ? "bg-default-100 font-medium text-foreground"
          : "text-default-700"
      }`}
    >
      <span className="min-w-0 truncate">{category.name}</span>
      <span
        aria-hidden
        className="ml-auto shrink-0 border-b border-dotted border-default-300"
      />
      <span
        className="shrink-0 text-xs tabular-nums text-default-600"
        aria-hidden
      >
        {category.blogCount > 0 ? category.blogCount : "None"}
      </span>
      <span className="sr-only">
        {category.blogCount > 0
          ? `${category.blogCount} ${category.blogCount === 1 ? "article" : "articles"}`
          : "No articles yet"}
      </span>
    </Link>
  </li>
);

/**
 * The feed's Categories card: a bounded summary, not a tag cloud.
 *
 * It shows the busiest categories, each with its article count, and a quiet
 * link to `/categories` for the rest. Capping it keeps one long taxonomy from
 * pushing the newsletter signup and the site links out of the rail.
 */
const Categories = ({
  categories,
  activeCategory,
}: {
  categories: ICategory[];
  /** The category whose page is open, so the card keeps its place. */
  activeCategory?: string;
}) => {
  const shown = topCategories(categories);

  return (
    <section
      aria-labelledby="feed-categories-title"
      className="rounded-[10px] border border-default/50 p-5"
    >
      <h2 id="feed-categories-title" className="text-sm font-semibold">
        Categories
      </h2>

      {shown.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-default-600">
          No categories yet. They appear here as articles are published.
        </p>
      ) : (
        <>
          <ul className="mt-3 space-y-0.5">
            {shown.map((category) => (
              <CategoryRow
                key={category._id}
                category={category}
                active={activeCategory === category.name}
              />
            ))}
          </ul>
          <Link
            href={categoriesPath}
            className="mt-3 inline-block rounded text-[0.8125rem] font-medium text-primary-accessible underline-offset-4 hover:underline"
          >
            All categories
          </Link>
        </>
      )}
    </section>
  );
};

/**
 * The same list as chips, for the places that have no rail: the mobile
 * categories page. Chips come from `CategoryButton`, the app's one category
 * control, so a category looks the same wherever it appears.
 */
export const CategoryChips = ({
  categories,
  activeCategory,
}: {
  categories: ICategory[];
  activeCategory?: string;
}) => {
  const shown = topCategories(categories, categories.length);

  if (shown.length === 0) {
    return (
      <p className="rounded-[10px] border border-default/60 px-6 py-10 text-center text-sm text-default-600">
        No categories yet. They appear here as articles are published.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {shown.map((category) => (
        <CategoryButton
          key={category._id}
          {...category}
          active={activeCategory === category.name}
        />
      ))}
    </div>
  );
};

export default Categories;
