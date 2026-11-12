import { AdSlot } from "@/components/adsense";
import FactList, { Fact, FactLink } from "@/components/editorial/fact-list";
import PageHero from "@/components/editorial/page-hero";
import ButtonLink from "@/components/ui/button-link";
import Container from "@/components/ui/container";
import { legalConfig } from "@/config/legal";
import { categoryPath } from "@/lib/feed-routes";
import { getBlogs } from "@/services/blog";
import { siteCategories } from "@/lib/site-settings";
import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowUpRight } from "react-icons/fi";

export const metadata: Metadata = {
  title: "About",
  description:
    "TechTipsHub publishes practical writing on web development, AI and the tools modern developers use. Learn what we cover and why.",
  alternates: { canonical: "/about" },
  openGraph: {
    title: "About TechTipsHub",
    description:
      "Practical writing on web development, AI and the tools modern developers use.",
    url: "/about",
  },
};

/** The standards every article is held to. Written as rules, not features. */
const standards = [
  {
    number: "01",
    title: "Written by practitioners",
    body: "Every article is written by someone who builds with the technology they are explaining. We do not publish pieces about tools we have never used.",
  },
  {
    number: "02",
    title: "Practical over promotional",
    body: "Worked examples and honest trade-offs, not listicles written to fill a slot. If something breaks, the article says where.",
  },
  {
    number: "03",
    title: "Reader signals are real",
    body: "Votes, comments and view counts come straight from the database. We never inflate them, and there is nothing to buy.",
  },
  {
    number: "04",
    title: "Open discussion",
    body: "Threaded comments let readers challenge a claim. Authors can reply, and corrections are noted on the article itself.",
  },
];

const About = async () => {
  const [blogsResult, categories] = await Promise.all([
    getBlogs({ limit: "1" }).catch(() => null),
    siteCategories(),
  ]);

  const articleCount = Number(blogsResult?.meta?.total) || 0;
  const topicCount = categories.length;

  return (
    <div>
      <section className="border-b border-default/60 bg-content-1/50">
        <Container>
          <div className="py-10 sm:py-14 lg:py-20">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-14">
              <div>
                <PageHero
                  eyebrow="About TechTipsHub"
                  title={
                    <>
                      Practical writing for people who{" "}
                      <span className="text-primary-accessible">
                        build software
                      </span>
                    </>
                  }
                  lede="TechTipsHub is an independent publication about web development, AI and the tools modern developers reach for every day. We favour clear explanations and working examples over hype."
                  meta={
                    <div className="flex flex-wrap items-center gap-3">
                      <ButtonLink
                        href="/signup"
                        radius="md"
                        color="primary"
                        className="font-semibold"
                      >
                        Join the community
                      </ButtonLink>
                      <ButtonLink
                        href="/contact"
                        radius="md"
                        variant="bordered"
                      >
                        Get in touch
                      </ButtonLink>
                    </div>
                  }
                />
              </div>

              {/* Publication masthead card */}
              <aside className="rounded-[10px] border border-default/70 border-t-2 border-t-primary bg-content-1 p-5 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-6">
                <h2 className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]">
                  The publication
                </h2>
                <p className="mt-1 text-xs text-default-600">
                  Independent, reader-supported technical writing.
                </p>
                <FactList label="Publication details" className="mt-4 border-b-0">
                  {articleCount > 0 && (
                    <Fact term="Articles published">
                      {articleCount.toLocaleString()}
                    </Fact>
                  )}
                  {topicCount > 0 && (
                    <Fact term="Topics covered">
                      {topicCount.toLocaleString()}
                    </Fact>
                  )}
                  <Fact term="Access">Free, no tiers</Fact>
                  <FactLink
                    term="Contact"
                    href={`mailto:${legalConfig.contactEmail}`}
                  >
                    {legalConfig.contactEmail}
                  </FactLink>
                </FactList>
              </aside>
            </div>
          </div>
        </Container>
      </section>

      <Container>
        {/* Mission & Pull Quote */}
        <section
          aria-labelledby="mission"
          className="grid items-center gap-8 border-b border-default/60 py-12 sm:py-16 lg:grid-cols-2 lg:gap-12"
        >
          <div>
            <h2 id="mission" className="tth-label">
              Our mission
            </h2>
            <p className="mt-3 font-[family-name:var(--type-editorial)] text-pretty text-2xl font-semibold leading-snug tracking-[-0.015em] sm:text-[1.75rem]">
              Make hard technical subjects approachable without dumbing them
              down.
            </p>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-default-600">
              A reader should finish an article able to try the idea themselves,
              and understand where it breaks.
            </p>
          </div>

          <blockquote className="rounded-[10px] border border-default/70 border-l-2 border-l-primary bg-content-1 p-6 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-7">
            <p className="font-[family-name:var(--type-editorial)] text-pretty text-lg leading-relaxed text-foreground">
              &ldquo;Tutorials, explanations of how things actually work, and
              honest comparisons of tools. If we have not used something in
              practice, we do not claim to have reviewed it.&rdquo;
            </p>
            <footer className="mt-4 text-xs font-medium text-default-600">
              TechTipsHub editorial standard
            </footer>
          </blockquote>
        </section>

        {/* Standards: 2x2 structured surface cards */}
        <section
          aria-labelledby="standards"
          className="border-b border-default/60 py-12 sm:py-16"
        >
          <div className="max-w-2xl">
            <h2 id="standards" className="tth-label">
              How we work
            </h2>
            <p className="mt-2 font-[family-name:var(--type-editorial)] text-2xl font-semibold tracking-[-0.015em]">
              The standards every article is held to
            </p>
          </div>

          <ol className="mt-8 grid gap-5 md:grid-cols-2">
            {standards.map((standard) => (
              <li
                key={standard.number}
                className="rounded-[10px] border border-default/70 bg-content-1 p-5 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-6"
              >
                <span className="inline-flex rounded-[6px] bg-primary/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-primary-accessible">
                  {standard.number}
                </span>
                <h3 className="mt-3 font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]">
                  {standard.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-default-600">
                  {standard.body}
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
                  Topics we cover
                </h2>
                <p className="mt-2 font-[family-name:var(--type-editorial)] text-2xl font-semibold tracking-[-0.015em]">
                  Browse published articles by subject
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
                    className="group flex min-h-11 items-center justify-between gap-4 rounded-[6px] border border-default/70 bg-content-1 px-4 py-3 transition-colors hover:border-primary/50 hover:bg-default-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <span className="truncate text-sm font-medium group-hover:text-primary-accessible">
                      {category.name}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums text-default-600">
                      {category.blogCount > 0 && category.blogCount}
                      <FiArrowUpRight
                        aria-hidden
                        className="size-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="pt-4">
          <AdSlot variant="display" placement="about-editorial-end" />
        </div>

        {/* Closing invitation banner */}
        <section className="py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-6 rounded-[10px] border border-default/70 bg-content-1 p-6 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="font-[family-name:var(--type-editorial)] text-pretty text-2xl font-semibold tracking-[-0.015em] md:text-[1.75rem]">
                Written with the community
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-default-600 sm:text-base">
                TechTipsHub is built by its readers as much as by its editors.
                If you know something worth sharing, you are welcome to publish
                it.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <ButtonLink href="/signup" radius="md" color="primary">
                Sign up free
              </ButtonLink>
              <ButtonLink href="/contact" radius="md" variant="bordered">
                Contact us
              </ButtonLink>
            </div>
          </div>
        </section>
      </Container>
    </div>
  );
};

export default About;
