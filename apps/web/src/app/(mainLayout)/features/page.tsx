import { AdSlot } from "@/components/adsense";
import PageHero from "@/components/editorial/page-hero";
import ButtonLink from "@/components/ui/button-link";
import Container from "@/components/ui/container";
import { categoryPath } from "@/lib/feed-routes";
import { getBlogs } from "@/services/blog";
import { siteCategories } from "@/lib/site-settings";
import { Metadata } from "next";
import Link from "next/link";
import { FiArrowUpRight } from "react-icons/fi";
import { RiCheckLine } from "react-icons/ri";

export const metadata: Metadata = {
  title: "Write and publish",
  description:
    "Share your tech knowledge on TechTipsHub: publish tutorials, reach readers who build software, and keep a public portfolio of your work.",
  keywords:
    "TechTipsHub, tech community, tech writing, knowledge sharing, tech tutorials, learning platform",
  alternates: { canonical: "/features" },
  openGraph: {
    title: "Write and publish on TechTipsHub",
    description:
      "Share your tech knowledge, learn from experts, and become part of our growing community.",
    url: "/features",
  },
};

/** The writing tools, described as what they do rather than feature names. */
const composer = [
  "Markdown-style shortcuts: type # for a heading, > for a quote, - for a list.",
  "Syntax-highlighted code blocks for every language you write about.",
  "Cover images, categories and tags, chosen when you publish.",
  "Preview the rendered article before it goes live.",
];

const community = [
  "Threaded comments on every article, and authors can reply.",
  "Follow the people whose work you want to read.",
  "Honest view and vote counts, straight from the database.",
  "A public profile with your bio, links and everything you have written.",
];

const steps = [
  {
    title: "Create a free account",
    body: "One form, no payment details. Every account has the same abilities; there is no paid tier.",
  },
  {
    title: "Draft in the composer",
    body: "Write with shortcuts, drop in code blocks and a cover image, then preview the piece as readers will see it.",
  },
  {
    title: "Publish, then keep it current",
    body: "Edit or remove any article from Manage Blogs at any time. No email required, no approval queue.",
  },
];

const CommunityPage = async () => {
  const [blogsResult, categories] = await Promise.all([
    getBlogs({ limit: "1" }).catch(() => null),
    siteCategories(),
  ]);

  const articleCount = Number(blogsResult?.meta?.total) || 0;

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-default/60 bg-content-1/50">
        <Container>
          <div className="grid items-start gap-8 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-14 lg:py-20">
            <PageHero
              eyebrow="Write for TechTipsHub"
              title={
                <>
                  Share your tech knowledge with people who{" "}
                  <span className="text-primary-accessible">build</span>
                </>
              }
              lede="Publish tutorials and explainers, reach readers who actually try the code, and keep a public portfolio of everything you have written."
              meta={
                <div className="flex flex-wrap items-center gap-3">
                  <ButtonLink
                    href="/signup"
                    radius="md"
                    color="primary"
                    className="font-semibold"
                  >
                    Start writing today
                  </ButtonLink>
                  <ButtonLink href="/" radius="md" variant="bordered">
                    Explore articles
                  </ButtonLink>
                </div>
              }
            />

            {(articleCount > 0 || categories.length > 0) && (
              <aside className="rounded-[10px] border border-default/70 border-t-2 border-t-primary bg-content-1 p-5 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-6">
                <h2 className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]">
                  Platform snapshot
                </h2>
                <p className="mt-1 text-xs text-default-600">
                  Live numbers from the publication database.
                </p>
                <dl className="mt-4 divide-y divide-default/60 border-t border-default/60">
                  {articleCount > 0 && (
                    <div className="flex items-baseline justify-between gap-4 py-3">
                      <dt className="text-sm text-default-600">
                        Articles published
                      </dt>
                      <dd className="text-lg font-semibold tabular-nums tracking-tight">
                        {articleCount.toLocaleString()}
                      </dd>
                    </div>
                  )}
                  {categories.length > 0 && (
                    <div className="flex items-baseline justify-between gap-4 py-3">
                      <dt className="text-sm text-default-600">
                        Topics to write in
                      </dt>
                      <dd className="text-lg font-semibold tabular-nums tracking-tight">
                        {categories.length.toLocaleString()}
                      </dd>
                    </div>
                  )}
                  <div className="flex items-baseline justify-between gap-4 py-3 pb-0">
                    <dt className="text-sm text-default-600">Writer tiers</dt>
                    <dd className="text-sm font-medium">Free, no paywall</dd>
                  </div>
                </dl>
              </aside>
            )}
          </div>
        </Container>
      </section>

      <Container>
        {/* What you get: two rich feature panels */}
        <section
          aria-labelledby="what-you-get"
          className="border-b border-default/60 py-12 sm:py-16"
        >
          <div className="max-w-2xl">
            <h2 id="what-you-get" className="tth-label">
              What you get
            </h2>
            <p className="mt-2 font-[family-name:var(--type-editorial)] text-2xl font-semibold tracking-[-0.015em]">
              Built so the platform stays out of the way of the writing
            </p>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div className="rounded-[10px] border border-default/70 bg-content-1 p-5 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-6">
              <h3 className="font-[family-name:var(--type-editorial)] text-xl font-semibold tracking-[-0.01em]">
                A composer that keeps up
              </h3>
              <p className="mt-1 text-sm text-default-600">
                Write, format code, and preview without fighting the editor.
              </p>
              <ul className="mt-5 divide-y divide-default/60 border-t border-default/60">
                {composer.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 py-3 text-sm leading-relaxed text-default-700 last:pb-0"
                  >
                    <RiCheckLine
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-primary-accessible"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[10px] border border-default/70 bg-content-1 p-5 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-6">
              <h3 className="font-[family-name:var(--type-editorial)] text-xl font-semibold tracking-[-0.01em]">
                Readers who take part
              </h3>
              <p className="mt-1 text-sm text-default-600">
                Real feedback and an author profile that collects your work.
              </p>
              <ul className="mt-5 divide-y divide-default/60 border-t border-default/60">
                {community.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 py-3 text-sm leading-relaxed text-default-700 last:pb-0"
                  >
                    <RiCheckLine
                      aria-hidden
                      className="mt-0.5 size-4 shrink-0 text-primary-accessible"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* How it works: 3 horizontal step cards */}
        <section
          aria-labelledby="how-it-works"
          className="border-b border-default/60 py-12 sm:py-16"
        >
          <div className="max-w-2xl">
            <h2 id="how-it-works" className="tth-label">
              How it works
            </h2>
            <p className="mt-2 font-[family-name:var(--type-editorial)] text-2xl font-semibold tracking-[-0.015em]">
              From sign-up to published article in three steps
            </p>
          </div>

          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="rounded-[10px] border border-default/70 bg-content-1 p-5 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-6"
              >
                <span className="inline-flex rounded-[6px] bg-primary/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-accessible">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="mt-3 font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-default-600">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        {/* Topics directory */}
        {categories.length > 0 && (
          <section
            aria-labelledby="topics"
            className="border-b border-default/60 py-12 sm:py-16"
          >
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="topics" className="tth-label">
                  What we publish
                </h2>
                <p className="mt-2 font-[family-name:var(--type-editorial)] text-2xl font-semibold tracking-[-0.015em]">
                  Write in any topic, or create a new one while drafting
                </p>
              </div>
              <Link
                href="/categories"
                className="text-sm font-medium text-primary-accessible underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                All categories
              </Link>
            </div>

            <ul className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => (
                <li key={category._id}>
                  <Link
                    href={categoryPath(category.name)}
                    className="group flex min-h-11 items-center justify-between gap-3 rounded-[6px] border border-default/70 bg-content-1 px-4 py-3 text-sm font-medium transition-colors hover:border-primary/50 hover:bg-default-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="truncate group-hover:text-primary-accessible">
                      {category.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-default-600">
                      {category.blogCount > 0 && category.blogCount}
                      <FiArrowUpRight
                        aria-hidden
                        className="size-3.5 opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="pt-4">
          <AdSlot variant="display" placement="features-topics-end" />
        </div>

        {/* Closing invitation banner */}
        <section className="py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-6 rounded-[10px] border border-default/70 bg-content-1 p-6 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="font-[family-name:var(--type-editorial)] text-pretty text-2xl font-semibold tracking-[-0.015em] md:text-[1.75rem]">
                Ready to share what you know?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-default-600 sm:text-base">
                Your first article is the hard one. After that it is just
                writing. Read the{" "}
                <Link
                  href="/community-guidelines"
                  className="font-medium text-primary-accessible underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  community guidelines
                </Link>{" "}
                first if you want to know what we look for.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <ButtonLink href="/signup" radius="md" color="primary">
                Create a free account
              </ButtonLink>
              <ButtonLink href="/about" radius="md" variant="bordered">
                About the publication
              </ButtonLink>
            </div>
          </div>
        </section>
      </Container>
    </div>
  );
};

export default CommunityPage;
