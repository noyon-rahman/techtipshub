import { AdSlot, MemberAdSlot } from "@/components/adsense";
import ArticleHeader from "@/components/modules/blog/article-header";
import ArticleState from "@/components/modules/blog/article-state";
import {
  ArticleAuthor,
  ArticleEndMatter,
  ArticleNewsletter,
  ArticleTags,
  BackToTop,
} from "@/components/modules/blog/article-end-matter";
import BlogComments from "@/components/modules/blog/blog-comments";
import LockedArticle from "@/components/modules/blog/locked-article";
import ReadingProgress from "@/components/modules/blog/reading-progress";
import { splitAfterIntro } from "@/components/modules/blog/split-article-intro";
import ArticleAccess from "@/components/modules/blog/article-access";
import Container from "@/components/ui/container";
import { siteConfig } from "@/config/site";
import {
  ARTICLE_PREVIEW_PARAM,
  ARTICLE_PREVIEW_VALUE,
  articleIndexablePath,
} from "@/lib/article-access";
import { articlePreviewHtml } from "@/lib/article-preview";
import { excerpt } from "@/lib/seo";
import { decodeSlug } from "@/lib/slug";
import { getArticlePage } from "@/services/blog/article-page";
import { blogForBuild, blogStaticParams } from "@/lib/blog-index";
import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

/**
 * Whether this render was asked for the `?view=preview` variant.
 *
 * A page that reads `searchParams` cannot be prerendered, so only the request
 * that carries the parameter is ever treated as one.
 */
const isPreviewRequest = (searchParams: Record<string, unknown>) => {
  const entry = Object.entries(searchParams).find(
    ([key]) => key === ARTICLE_PREVIEW_PARAM,
  );
  const view = entry?.[1];

  return (
    view === ARTICLE_PREVIEW_VALUE ||
    (Array.isArray(view) && view.includes(ARTICLE_PREVIEW_VALUE))
  );
};

/**
 * Expiry is driven by the data layer, not by a page-level tag: the article and
 * comments carry the `articleData` tag, and the blog services expire it when an
 * article or a comment changes. A page-level `export const tags` is not a
 * segment config here - it makes the route look dynamic and every article stops
 * being prerendered.
 */

/**
 * The article this render describes, read the way the page reads it.
 *
 * The build index already fetched every article once, so `generateMetadata`
 * checks it first: a slug the build saw costs a map lookup and no request. A
 * slug published after the last build has no row there, and this is what reads
 * it. Before, metadata answered from the index alone, so such a slug got the
 * not-found head over a body that rendered perfectly.
 *
 * Both callers now go through `getArticlePage`, the one place that decides which
 * version a render is for. The `updatedAt` the page was built with is in its
 * stored `params`, the same value the page itself is handed, so the head and the
 * body describe one article.
 */
const readForRender = async (params: Props["params"]) => {
  const { slug: routeSlug, updatedAt: builtAsOf } = (await params) as {
    slug: string;
    updatedAt?: string;
  };

  return getArticlePage(decodeSlug(routeSlug), builtAsOf);
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug: routeSlug } = await params;
  const slug = decodeSlug(routeSlug);
  // The build index has every article the build saw, so a known slug costs a
  // map lookup and no request. A slug published since then is read from the
  // service, exactly as the page reads it.
  const blog = (await blogForBuild(slug)) ?? (await readForRender(params)).blog;
  const { title, content, coverImage, tags, author, createdAt, updatedAt } =
    blog ?? {};

  const description = content ? excerpt(content, 160) : undefined;
  // A public article is readable and canonical at the plain address. A
  // members-only one is canonical at the preview variant: it is the one search
  // engines and link unfurls can read without a session, since the plain
  // address carries a body that waits on the reader check.
  const canonical = articleIndexablePath(slug, blog?.access);
  // Blogs without an upload fall back to the brand cover, so a shared link
  // still shows the house mark rather than no image at all.
  const ogImage = coverImage
    ? [{ url: coverImage, alt: title }]
    : [
        {
          url: "/brand/og-image.png",
          width: 1200,
          height: 630,
          alt: siteConfig.name,
        },
      ];
  const published = createdAt ? new Date(createdAt) : undefined;
  const modified = updatedAt ? new Date(updatedAt) : published;

  if (!blog) {
    // A deleted or mistyped slug should drop out of the index, not be
    // remembered as a thin page.
    return {
      title: "Article not found",
      robots: { index: false, follow: false },
    };
  }

  return {
    title: title,
    description: description,
    alternates: { canonical },
    keywords: [...(tags ?? []), siteConfig.name, "blog post", "tutorial"],
    authors: author?.fullName
      ? [{ name: author.fullName, url: `/users/${author.username}` }]
      : undefined,
    openGraph: {
      title: title,
      description: description,
      url: canonical,
      images: ogImage,
      siteName: siteConfig.name,
      type: "article",
      publishedTime: published?.toISOString(),
      modifiedTime: modified?.toISOString(),
      authors: author?.fullName ? [author.fullName] : undefined,
      tags: tags,
    },
    twitter: {
      card: "summary_large_image",
      title: title,
      description: description,
      images: ogImage.map((image) => image.url),
    },
  };
}

/**
 * Prerender every published article at build time.
 *
 * The stored `params` carry the article's `updatedAt` as of the build, which is
 * how the page knows whether it still holds the current version.
 */
export async function generateStaticParams() {
  return blogStaticParams();
}

const readingMinutes = (html?: string) => {
  if (!html) return null;
  const words = html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
};

const DynamicBlogPage = async ({ params, searchParams }: Props) => {
  // The plain address is what members are served, and what a preview link is
  // redirected from (see `proxy.ts`): a crawler, or anyone without a session,
  // ends up on the preview variant. The version read is the same one
  // `generateMetadata` uses, so the head and the body describe one article.
  const page = await readForRender(params);
  const { slug: routeSlug } = (await params) as { slug: string };
  const slug = decodeSlug(routeSlug);

  if (!page.blog) {
    return (
      <section className="pb-16">
        <Container>
          <ArticleState
            kind="notFound"
            loginHref={`/login?redirect=${encodeURIComponent(`blogs/${routeSlug}`)}`}
            redirectPath={`blogs/${routeSlug}`}
          />
        </Container>
      </section>
    );
  }

  // A public article needs no preview: the plain page already carries the whole
  // body for everyone, so a link or a crawler that still asks for the variant
  // is sent to the one address this article is canonical at.
  if (page.blog.access === "public" && isPreviewRequest(await searchParams)) {
    redirect(`/blogs/${encodeURIComponent(slug)}`);
  }

  const {
    _id,
    coverImage,
    title,
    author,
    createdAt,
    updatedAt,
    content,
    tags,
    totalViews,
    totalComments,
    category,
  } = page.blog;
  const comments = page.comments;
  // A public article is the same document for every visitor, so its body does
  // not wait on the reader check and the members prompt never appears.
  const isPublic = page.blog.access === "public";

  const minutes = readingMinutes(content);
  const loginHref = `/login?redirect=${encodeURIComponent(`blogs/${routeSlug}`)}`;

  // The author panel hides its Follow control on the reader's own article.
  // That is decided in the browser by `FollowUnFollowButton`, from the session
  // it already holds: reading the cookie here would turn every article into a
  // per-request render, which is what kept these pages out of the static cache.
  const isOwnArticle = false;

  // What a visitor without a session is given server-side: the introduction,
  // cut where the member reading experience cuts the body for its ad. This is
  // the only version of the body a crawler is shown.
  const previewBody = articlePreviewHtml(content);

  // The in-article unit goes between the opening paragraph and the rest. A
  // body with no safe paragraph break renders whole, with the ad after it.
  // Both halves keep their own class so the body's type rules stay continuous.
  const introSplit = splitAfterIntro(content);

  // The preview dissolves rather than stopping: a mask on the element itself
  // takes the text from full opacity to nothing over its last lines. A mask,
  // not a gradient laid over the text, so it always bites into real lines
  // however long the preview is.
  //
  // The stop is a share of the element (`25%`) rather than a fixed length: a
  // fixed 88px lands in empty space on a short preview, so nothing fades. A
  // percentage always meets the last lines, and a shorter preview fades over
  // a shorter distance instead of washing out a whole paragraph.
  const previewMask = "linear-gradient(to bottom, #000 75%, transparent 100%)";

  const previewColumn = (
    <>
      <div
        className="tth-article mt-10 print:mt-0"
        style={{ maskImage: previewMask, WebkitMaskImage: previewMask }}
        dangerouslySetInnerHTML={{ __html: previewBody }}
      />
      <LockedArticle
        redirectPath={`blogs/${routeSlug}`}
        loginHref={loginHref}
      />
    </>
  );

  // The body for members. Ads sit inside it and only load once the reader is
  // confirmed, so a cached copy watched by a guest requests nothing.
  const memberColumn = (
    <>
      {introSplit ? (
        <>
          <div
            className="tth-article mt-10 print:mt-0"
            dangerouslySetInnerHTML={{ __html: introSplit[0] }}
          />
          <MemberAdSlot
            variant="inArticle"
            placement="article-after-intro"
            className="mt-10 print:hidden"
          />
          <div
            className="tth-article tth-article-continued"
            dangerouslySetInnerHTML={{ __html: introSplit[1] }}
          />
        </>
      ) : (
        <>
          <div
            className="tth-article mt-10 print:mt-0"
            dangerouslySetInnerHTML={{ __html: content ?? "" }}
          />
          <MemberAdSlot
            variant="inArticle"
            placement="article-after-intro"
            className="mt-10 print:hidden"
          />
        </>
      )}

      {/*
        "Was this useful?" belongs to someone who has read the article. A guest
        has only seen the introduction, so voting on it, sharing it as read or
        opening its discussion asks a decision about something they were not
        shown. It sits inside the member half, so it is hidden by the same rule
        as the body (see `globals.css`) and costs the prerendered document
        nothing.
      */}
      <ArticleEndMatter blog={page.blog} />
    </>
  );
  // The two columns are always in the document; CSS picks one from
  // `data-article-view`, which the per-request reader answer writes (see the
  // article access rules in `globals.css`). Neither the page nor its caching
  // depends on who is asking.
  //
  // A public article has nothing to choose between: every reader gets the body
  // above, so no check is mounted and no column is picked.
  const readableColumn = (
    <div data-article-access {...(isPublic && { "data-article-public": "" })}>
      {!isPublic && <ArticleAccess key={slug} />}
      {!isPublic && <div data-article-for="guest">{previewColumn}</div>}
      <div data-article-for="member">{memberColumn}</div>
    </div>
  );

  return (
    <section className="pb-16">
      <ReadingProgress targetId="article-body" />
      <Container>
        <article
          id="article-body"
          itemScope
          itemType="https://schema.org/BlogPosting"
          className="mx-auto max-w-read scroll-mt-20 pt-4 print:max-w-xl print:pt-0"
        >
          {/* Structured data: who wrote it, when, and what it is about. Search
              results and readers both get the byline from one place. */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "BlogPosting",
                headline: title,
                description: excerpt(content, 160),
                image: coverImage ? [coverImage] : undefined,
                datePublished: createdAt,
                dateModified: updatedAt ?? createdAt,
                author: author?.fullName
                  ? {
                      "@type": "Person",
                      name: author.fullName,
                      url: `${siteConfig.url}/users/${author.username}`,
                    }
                  : undefined,
                publisher: {
                  "@type": "Organization",
                  name: siteConfig.name,
                  logo: {
                    "@type": "ImageObject",
                    url: `${siteConfig.url}/brand/icon-512.png`,
                  },
                },
                mainEntityOfPage: `${siteConfig.url}${articleIndexablePath(slug, page.blog.access)}`,
                keywords: tags?.join(", "),
              }),
            }}
          />
          <div id="article-start" className="scroll-mt-24">
            <ArticleHeader
              slug={routeSlug}
              title={title}
              author={author}
              category={category}
              createdAt={createdAt}
              minutes={minutes}
              views={totalViews ?? 0}
            />
          </div>

          {coverImage && (
            <figure className="mt-8 print:hidden">
              <div className="relative aspect-[16/9] overflow-hidden rounded-[10px] border border-default/60 bg-default-100 sm:aspect-[2/1]">
                <Image
                  className="object-cover"
                  src={coverImage}
                  alt={title}
                  fill
                  priority
                  sizes="(min-width: 768px) 46rem, 100vw"
                />
              </div>
            </figure>
          )}

          {readableColumn}

          <ArticleTags tags={tags} />

          <ArticleNewsletter />

          <ArticleAuthor author={author} isOwnArticle={isOwnArticle} />

          {/* Multiplex is a recommendation grid: it belongs where the reader
              has finished and is choosing what to read next, not mid-article.
              It replaces the old display unit here; two ad blocks back to back
              in the same spot tend to perform worse than one. */}
          <div className="mt-14 print:hidden">
            <AdSlot variant="multiplex" placement="article-after-story" />
          </div>

          <div className="mt-14">
            <BlogComments
              blogId={_id}
              comments={comments}
              totalComments={totalComments ?? 0}
              redirectPath={`blogs/${routeSlug}`}
            />
          </div>

          <BackToTop />
        </article>
      </Container>
    </section>
  );
};

export default DynamicBlogPage;
