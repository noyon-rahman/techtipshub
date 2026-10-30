import { CategoryChips } from "@/components/modules/feed/right-sidebar/category-list";
import { siteCategories } from "@/lib/site-settings";
import type { Metadata } from "next";

/**
 * `/categories`: every category in one place.
 *
 * The feed's card is capped and the rail is hidden below 1280px, so this is
 * where the rest of the taxonomy lives, on a phone as much as on a desktop.
 * It is generated from the same tag-cached list the feed reads, so an admin's
 * new category shows up here without a deploy.
 */
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Categories",
  description:
    "Every topic on TechTipsHub, from React to career advice. Pick one to read its articles newest first.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const categories = await siteCategories();

  return (
    <div>
      <header className="border-b border-default/60 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Categories</h1>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-default-600">
          Every topic on the site. Pick one to read its articles, newest first.
        </p>
      </header>

      <div className="mt-5">
        <CategoryChips categories={categories} />
      </div>
    </div>
  );
}
