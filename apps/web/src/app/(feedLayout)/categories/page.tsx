import {
  browseHref,
  topCategories,
} from "@/components/modules/feed/right-sidebar/category-list";
import { siteCategories } from "@/lib/site-settings";
import type { ICategory } from "@/types";
import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowUpRight } from "react-icons/fi";

/**
 * `/categories`: every topic on the site, in the order a reader can scan them.
 *
 * The feed's card is capped and the rail is hidden below 1280px, so this is
 * where the rest of the taxonomy lives, on a phone as much as on a desktop.
 * It reads the same tag-cached list the feed does, so an admin's new category
 * shows up here without a deploy.
 *
 * Each row carries what the choice actually costs: how many articles sit behind
 * it, and a bar for its share of the busiest topic. A bare list of names makes
 * a reader guess, and a topic with no articles is a dead end they cannot see.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Categories",
  description:
    "Every topic on TechTipsHub, from React to career advice. Pick one to read its articles newest first.",
  alternates: { canonical: "/categories" },
};

const articleCount = (count: number) =>
  count === 0
    ? "No articles yet"
    : `${count} ${count === 1 ? "article" : "articles"}`;

/**
 * Rows are alphabetical, because the page is a directory rather than a chart:
 * a reader arrives knowing the topic, not wanting the first one in a ranking.
 * The list only gets a stamina cap far above the real size, so `topCategories`
 * can still drop a deleted row in one place for the whole site.
 */
const alphabetical = (categories: ICategory[]) =>
  topCategories(categories, categories.length).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

/** One category: name, how much is in it, and a bar for the share of the site. */
const CategoryRow = ({
  category,
  largest,
}: {
  category: ICategory;
  largest: number;
}) => {
  const count = category.blogCount ?? 0;
  const share = largest > 0 ? Math.round((count / largest) * 100) : 0;

  return (
    <li>
      <Link
        href={browseHref(category)}
        className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-[8px] px-3 py-3 transition-colors hover:bg-default-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
      >
        <span className="flex min-w-0 items-baseline gap-2 text-[0.9375rem] font-medium text-foreground">
          <span className="truncate">{category.name}</span>
          <FiArrowUpRight
            aria-hidden
            className="size-3.5 shrink-0 text-default-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
          />
        </span>

        <span className="text-right text-xs tabular-nums text-default-600">
          {articleCount(count)}
        </span>

        {/* The bar is the count twice: a reader who cannot see it still has the
            number and the row's link, so it is drawn as decoration. A topic
            with nothing in it shows no bar rather than an empty track, which
            would read as a loading state. */}
        {count > 0 && (
          <span
            aria-hidden
            className="col-span-2 block h-[3px] w-full overflow-hidden rounded-full bg-default-100"
          >
            <span
              className="block h-full rounded-full bg-primary/70"
              style={{ width: `${Math.max(share, 4)}%` }}
            />
          </span>
        )}
      </Link>
    </li>
  );
};

/**
 * The way on, past the directory. Kept as links rather than words so the page
 * ends in something a reader can do, and set apart by a rule so it does not
 * read as one more category.
 */
const NextSteps = () => (
  <section
    aria-labelledby="categories-next"
    className="mt-10 border-t border-default/60 pt-6"
  >
    <h2 id="categories-next" className="tth-label">
      Not sure where to start
    </h2>
    <ul className="mt-3 flex flex-col gap-2 text-sm">
      <li>
        <Link
          href="/"
          className="text-primary-accessible underline-offset-4 hover:underline"
        >
          Read the latest articles instead
        </Link>
        <span className="text-default-600">
          , newest first across every topic.
        </span>
      </li>
      <li>
        <span className="text-default-600">
          Missed a topic? Ask for it while writing: the request goes to the
          editors, who add it to this list once they review it.
        </span>
      </li>
    </ul>
  </section>
);

export default async function CategoriesPage() {
  const categories = await siteCategories();
  const shown = alphabetical(categories);
  const largest = shown.reduce(
    (max, category) => Math.max(max, category.blogCount ?? 0),
    0,
  );
  const filled = shown.filter((category) => (category.blogCount ?? 0) > 0).length;

  return (
    <div>
      <header className="border-b border-default/60 pb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Categories
        </h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-default-600">
          Every topic on the site. {shown.length} to choose from, and{" "}
          {filled === 1
            ? "one already has articles"
            : `${filled} already have articles`}
          . Pick one to read it newest first.
        </p>
      </header>

      {shown.length === 0 ? (
        <p className="mt-6 rounded-[10px] border border-default/60 px-6 py-10 text-center text-sm text-default-600">
          No categories yet. They appear here as articles are published.
        </p>
      ) : (
        <ul className="-mx-3 mt-3 divide-y divide-default/50">
          {shown.map((category) => (
            <CategoryRow
              key={category._id}
              category={category}
              largest={largest}
            />
          ))}
        </ul>
      )}

      <NextSteps />
    </div>
  );
}
