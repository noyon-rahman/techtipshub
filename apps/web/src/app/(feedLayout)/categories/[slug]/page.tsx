import FeedBlogs from "@/components/modules/feed";
import { getBlogs } from "@/services/blog";
import { categorySlug } from "@/lib/feed-routes";
import { siteCategories } from "@/lib/site-settings";
import { IBlog } from "@/types";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowLeft } from "react-icons/fi";

/**
 * `/categories/<name>`: the feed filtered to one category.
 *
 * The category's own URL, so the landing page stays prerendered and each
 * category can be crawled and ranked on its own. Known categories are
 * prerendered from the list the feed already fetches; anything else renders on
 * first request and 404s if no category matches.
 */
export const revalidate = 1800;

type Props = {
  params: Promise<{ slug: string }>;
};

/** Articles on the category's first page; the rest load as the reader scrolls. */
const INITIAL_NUMBERS_OF_BLOGS = "10";

/** The published category whose slug is `slug`, or undefined. */
const findCategory = async (slug: string) => {
  const categories = await siteCategories();
  return categories.find(
    (category) => categorySlug(category.name) === slug && !category.isDeleted,
  );
};

export async function generateStaticParams() {
  const categories = await siteCategories();
  return categories
    .filter((category) => !category.isDeleted)
    .map((category) => ({ slug: categorySlug(category.name) }))
    .filter((entry) => entry.slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await findCategory(slug);

  if (!category) {
    return {
      title: "Category not found",
      robots: { index: false, follow: false },
    };
  }

  const description =
    category.description ||
    `Articles filed under ${category.name} on TechTipsHub.`;

  return {
    title: category.name,
    description,
    alternates: { canonical: `/categories/${slug}` },
    openGraph: {
      title: `${category.name} articles`,
      description,
      url: `/categories/${slug}`,
      type: "website",
    },
  };
}

export default async function CategoryFeed({ params }: Props) {
  const { slug } = await params;
  const category = await findCategory(slug);

  if (!category) notFound();

  const data = await getBlogs({
    category: category.name,
    limit: INITIAL_NUMBERS_OF_BLOGS,
    sort: "newest",
  });
  const blogs = (data?.data as IBlog[]) || [];

  if (blogs.length === 0) {
    return (
      <div>
        <div className="mb-4">
          <Link
            href="/categories"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-default-600 transition-colors hover:text-primary-accessible sm:min-h-0"
          >
            <FiArrowLeft aria-hidden className="size-3.5" />
            All categories
          </Link>
        </div>
        <div className="rounded-[10px] border border-default/60 bg-content-1 px-6 py-16 text-center">
          <h1 className="font-[family-name:var(--type-editorial)] text-2xl font-semibold">
            Nothing in {category.name} yet
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-default-600">
            New articles will appear here as soon as they are published.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3">
        <Link
          href="/categories"
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-default-600 transition-colors hover:text-primary-accessible sm:min-h-0"
        >
          <FiArrowLeft aria-hidden className="size-3.5" />
          All categories
        </Link>
      </div>
      <FeedBlogs initialBlogs={blogs} category={category.name} sort="newest" />
    </div>
  );
}
