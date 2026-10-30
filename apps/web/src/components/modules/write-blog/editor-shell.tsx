"use client";

import {
  EditorSurface,
  EditorToolbar,
} from "@/components/editor/rich-text-editor";
import type { BlogEditor } from "@/components/editor/rich-text-editor";
import AutoGrowTextarea from "@/components/modules/write-blog/auto-grow-textarea";
import CategoryPicker from "@/components/modules/write-blog/category-picker";
import TagInput from "@/components/modules/write-blog/tag-input";
import { ICategory } from "@/types";
import { formatBlogDate } from "@/utils";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
} from "@heroui/react";
import Link from "next/link";
import type { ReactNode, RefObject } from "react";
import { LuArrowLeft, LuEye, LuExternalLink } from "react-icons/lu";

/**
 * The width of a text column inside an article screen.
 *
 * `max-w-read` (48rem, from globals.css) is the column a published article
 * reads in, so the title, the body and the piece's actions keep that measure.
 * The frame itself is full page width, so the cover and the toolbar run edge to
 * edge with the rest of the site.
 */
export const MEASURE = "w-full max-w-read";

/**
 * Outer gutters for an article screen. These are `Container`'s, so the page bar
 * and the frame around the piece line up with the header, the footer and every
 * other page instead of sitting in a narrower box of their own.
 */
const FRAME_GUTTERS = "px-4 sm:px-6 lg:px-8";

/**
 * The frame an article screen falls back to when there is nothing to edit:
 * a dead end still sits on the site's page width and gutters.
 */
export const EditorMessageFrame = ({ children }: { children: ReactNode }) => (
  <div className={`mx-auto w-full max-w-page py-10 ${FRAME_GUTTERS}`}>
    <div className="max-w-read space-y-6">{children}</div>
  </div>
);

/**
 * The frame every article screen sits in.
 *
 * The page's own width, holding the piece. The writing column is centred inside
 * it, with the publishing details in a rail beside that column on large screens
 * and directly under the piece below that. The rail is sticky, so the category
 * and tags are never a scroll away while the writer works down a long body.
 *
 * The bar above holds only what is true at any scroll position: how to get out,
 * what state the piece is in, and what to do next.
 */
export const EditorShell = ({
  onLeave,
  leaveLabel,
  eyebrow,
  status,
  actions,
  banner,
  sidebar,
  footer,
  children,
  barStickyClass,
  railStickyClass,
}: {
  onLeave: () => void;
  /** What leaving costs, said plainly: "My articles", "Close". */
  leaveLabel: string;
  /** The line above the status: "New blog", "Editing". */
  eyebrow: ReactNode;
  status: ReactNode;
  actions: ReactNode;
  /** Full-width notice above the piece: a recoverable draft, for example. */
  banner?: ReactNode;
  /** Publishing details on wide screens; rendered under the piece below that. */
  sidebar: ReactNode;
  /**
   * Actions under the piece. On phones they render after the publishing
   * details, so the fields the publish button needs come before it.
   */
  footer?: ReactNode;
  children: ReactNode;
  /** Sticky offset under the surrounding shell's header, e.g. the admin bar. */
  barStickyClass?: string;
  /** Sticky offset of the publishing rail under that same header. */
  railStickyClass?: string;
}) => (
  <>
    <PageBar
      onLeave={onLeave}
      leaveLabel={leaveLabel}
      eyebrow={eyebrow}
      status={status}
      actions={actions}
      stickyClass={barStickyClass}
    />

    <div className={`mx-auto w-full max-w-page pb-24 pt-6 ${FRAME_GUTTERS}`}>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(15rem,18rem)] lg:items-start lg:gap-12 xl:gap-16">
        <div className="min-w-0">
          {banner && <div className="mb-8">{banner}</div>}
          {children}
          <div className="lg:hidden">{sidebar}</div>
          {footer}
        </div>
        <div
          className={`hidden lg:block lg:sticky ${
            railStickyClass ?? "lg:top-[calc(var(--header-height)+3.5rem)]"
          }`}
        >
          {sidebar}
        </div>
      </div>
    </div>
  </>
);

/**
 * The bar at the top of an article screen.
 *
 * It sticks under the site header and is sized like it. On a wide screen it is
 * one row on the page's axis: the way out, the state of the piece, the next
 * step. On a narrow one that row has no width to share, so it becomes three
 * bands, each the full width: the way out on its own line, the state whole
 * beneath it, then the actions side by side. Nothing is squeezed into a column
 * of four-word lines.
 *
 * It deliberately does not blur: the header above it already does, and two
 * frosted layers stacked on a writing surface muddy both.
 */
const PageBar = ({
  onLeave,
  leaveLabel,
  eyebrow,
  status,
  actions,
  stickyClass = "top-[var(--header-height)]",
}: {
  onLeave: () => void;
  leaveLabel: string;
  eyebrow: ReactNode;
  status: ReactNode;
  actions: ReactNode;
  stickyClass?: string;
}) => (
  <div
    className={`sticky ${stickyClass} z-30 border-b border-default-200 bg-background`}
  >
    <div
      className={`mx-auto flex w-full max-w-page flex-col gap-y-2 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:py-2 ${FRAME_GUTTERS}`}
    >
      <Link
        href="#"
        onClick={(event) => {
          event.preventDefault();
          onLeave();
        }}
        className="inline-flex min-h-9 shrink-0 items-center gap-1.5 self-start rounded-md py-1 pr-2 text-sm font-medium text-default-600 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
      >
        <LuArrowLeft aria-hidden className="size-4" />
        {leaveLabel}
      </Link>

      <span
        aria-hidden
        className="hidden h-4 w-px shrink-0 bg-default-200 sm:block"
      />

      <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2.5 gap-y-1 sm:gap-y-0.5">
        <span className="w-full shrink-0 truncate text-[0.8125rem] font-medium text-foreground sm:w-auto">
          {eyebrow}
        </span>
        <span aria-hidden className="hidden text-default-300 sm:inline">
          ·
        </span>
        <div
          role="status"
          aria-live="polite"
          className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] text-default-600"
        >
          {status}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
        {actions}
      </div>
    </div>
  </div>
);

/** A label for a field or a quiet section: sentence case, 13px, muted. */
export const SectionLabel = ({ children }: { children: ReactNode }) => (
  <p className="text-[0.8125rem] font-medium text-default-600">{children}</p>
);

interface IWritingPaneProps {
  titleId: string;
  titleRef?: RefObject<HTMLTextAreaElement | null>;
  title: string;
  titlePlaceholder: string;
  onTitleChange: (value: string) => void;
  onTitleEnter?: () => void;
  titleError?: string;
  onTitleFocus?: () => void;
  /** Hint under the title, above the toolbar. */
  titleHint?: string;

  cover: ReactNode;
  /** Shown directly under the cover (e.g. "removing a cover is not supported"). */
  coverNote?: ReactNode;
  /** The cover is missing and the writer has been told. */
  coverError?: string;
  /** A label above the cover strip. */
  coverLabel?: string;

  /** The formatting toolbar, at the top of the column it formats. */
  toolbar?: ReactNode;
  body: ReactNode;
  bodyError?: string;
  /** Where a writer starts: the shortcuts hint, the word count. */
  bodyFooter?: ReactNode;
}

/**
 * Cover strip, title, formatting bar and writing surface.
 *
 * The cover opens the page because it is the first thing a reader sees, and it
 * doubles as the writer's one way of checking the crop. The title keeps the
 * published scale, so the screen already looks like the result, and the toolbar
 * sits directly above the text it acts on rather than travelling with the
 * scroll position.
 */
export const WritingPane = ({
  titleId,
  titleRef,
  title,
  titlePlaceholder,
  onTitleChange,
  onTitleEnter,
  titleError,
  onTitleFocus,
  titleHint,
  cover,
  coverNote,
  coverError,
  coverLabel,
  toolbar,
  body,
  bodyError,
  bodyFooter,
}: IWritingPaneProps) => (
  <div className={`${MEASURE} tth-writing-surface`}>
    {coverLabel && <SectionLabel>{coverLabel}</SectionLabel>}
    <div className={coverLabel ? "mt-2.5" : ""}>{cover}</div>
    {coverError && <FieldError className="mt-1.5">{coverError}</FieldError>}
    {coverNote}

    <div className="mt-6">
      <label htmlFor={titleId} className="sr-only">
        Title
      </label>
      <AutoGrowTextarea
        id={titleId}
        ref={titleRef}
        value={title}
        onChange={onTitleChange}
        onFocus={onTitleFocus}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onTitleEnter) {
            event.preventDefault();
            onTitleEnter();
          }
        }}
        maxLength={140}
        placeholder={titlePlaceholder}
        aria-invalid={Boolean(titleError)}
        aria-describedby={titleError ? `${titleId}-error` : undefined}
        className={`${TITLE_CLASS} ${
          titleError ? "rounded-md ring-1 ring-danger" : ""
        }`}
      />
      <div className="mt-1.5 flex items-start justify-between gap-3">
        {titleError ? (
          <FieldError id={`${titleId}-error`}>{titleError}</FieldError>
        ) : (
          <p className="text-[0.8125rem] text-default-600">{titleHint}</p>
        )}
        {/* Quiet until the writer approaches the limit, when it is a fact. */}
        <span
          aria-hidden
          className={`shrink-0 text-xs tabular-nums ${
            title.length > 120
              ? "text-warning-600 dark:text-warning"
              : "text-default-600"
          }`}
        >
          {title.length}/140
        </span>
      </div>
    </div>

    {toolbar && (
      <div className={`${MEASURE} mt-5 border-y border-default-200 py-1`}>
        {toolbar}
      </div>
    )}

    <div className="mt-2">{body}</div>
    {bodyError && <FieldError className="mt-1">{bodyError}</FieldError>}
    {bodyFooter}
  </div>
);

export const TITLE_CLASS =
  "w-full resize-none overflow-hidden rounded-sm bg-transparent font-sans text-3xl font-semibold leading-[1.15] tracking-[-0.02em] text-foreground placeholder:text-default-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-300 sm:text-4xl md:text-[2.75rem]";

/** The body editor, inside the surface the screen supplies. */
export const EditorBody = ({
  editor,
  invalid,
}: {
  editor: BlogEditor;
  invalid?: boolean;
}) => <EditorSurface editor={editor} hasError={invalid} />;

/** The formatting tools, as they sit at the top of the writing column. */
export const ComposerToolbar = ({ editor }: { editor: BlogEditor }) => (
  <EditorToolbar editor={editor} />
);

interface IPublishingDetailsProps {
  idPrefix: string;
  /**
   * `rail` fills the sidebar column; `page` is the same panel under the piece
   * at page width.
   */
  placement?: "rail" | "page";
  /** The stored address, when the screen lets the writer change it. */
  slug?: string;
  /** With `slug`, makes the address its own section above the panel. */
  slugTitle?: string;
  slugPrefix?: string;
  onSlugChange?: (slug: string) => void;
  slugError?: string;
  /** What happens to the address when saved. The admin editor is blunter. */
  slugHint?: string;
  categories: ICategory[];
  category: string;
  onCategoryChange: (category: string) => void;
  categoryError?: string;
  /** The category list is being fetched. */
  categoriesLoading?: boolean;
  /** The category list could not be loaded. */
  categoriesError?: string;
  /** Retry the category list. */
  onRetryCategories?: () => void;
  /** The writer asked for a category that is not in the list. */
  onRequestCategory?: (name: string) => void;
  /** Categories this draft requested, so they stay selectable. */
  requestedCategories?: { id: string; name: string; pending: boolean }[];
  /** The name of a selected category the list does not hold yet. */
  categorySelectedName?: string;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  tagInput: string;
  onTagInputChange: (value: string) => void;
  tagSuggestions: string[];
  tagsError?: string;
  onTagsRejected?: (raw: string, rejected: string[]) => void;
  /** Anything that belongs under the two fields: the summary of choices. */
  footer?: ReactNode;
}

/**
 * Category and tags: the rail beside the piece on wide screens, and the panel
 * under it otherwise.
 *
 * Both are required to publish, so neither is hidden behind a disclosure: a
 * writer who has finished the body should not have to discover that two more
 * fields are waiting. They sit in one quiet panel with a hairline rather than
 * floating on the page, because the rail is a separate object from the piece.
 * The caller decides which of the two places it is in, since it knows whether
 * it is rendering the rail or the band under the piece.
 */
export const PublishingDetails = ({
  idPrefix,
  placement = "page",
  slug,
  slugTitle,
  slugPrefix,
  onSlugChange,
  slugError,
  slugHint = "Lowercase letters, numbers and hyphens. Changing it moves the article.",
  categories,
  category,
  onCategoryChange,
  categoryError,
  categoriesLoading = false,
  categoriesError,
  onRetryCategories,
  onRequestCategory,
  requestedCategories = [],
  categorySelectedName,
  tags,
  onTagsChange,
  tagInput,
  onTagInputChange,
  tagSuggestions,
  tagsError,
  onTagsRejected,
  footer,
}: IPublishingDetailsProps) => {
  const requirement =
    category && tags.length
      ? "Category and tags are set."
      : !category && !tags.length
        ? "Publishing needs a category and tags."
        : !category
          ? "Publishing needs a category."
          : "Publishing needs tags.";

  const address = onSlugChange ? (
    <div className={slugTitle ? "" : "mt-5"}>
      <label
        htmlFor={`${idPrefix}-slug`}
        className={`mb-1.5 block text-[0.8125rem] font-medium ${
          slugTitle ? "text-foreground" : "text-default-600"
        }`}
      >
        {slugTitle ?? "Address"}
      </label>
      <Input
        id={`${idPrefix}-slug`}
        aria-label="Article address"
        value={slug ?? ""}
        onValueChange={onSlugChange}
        variant="bordered"
        radius="sm"
        size="sm"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck="false"
        startContent={
          <span className="shrink-0 text-sm text-default-600">
            {slugPrefix ?? "/blogs/"}
          </span>
        }
        isInvalid={Boolean(slugError)}
        errorMessage={slugError}
        classNames={{ inputWrapper: "min-h-10" }}
      />
      {!slugError && (
        <p className="mt-1.5 text-xs leading-relaxed text-default-600">
          {slugHint}
        </p>
      )}
    </div>
  ) : null;

  const details = (
    <aside
      aria-labelledby={`${idPrefix}-details-title`}
      className={`border-t border-default-200 pt-6 lg:rounded-[10px] lg:border lg:p-5 lg:pt-4 ${
        placement === "rail" ? "" : "mt-14"
      }`}
    >
      <h2
        id={`${idPrefix}-details-title`}
        className="text-[0.8125rem] font-medium text-foreground"
      >
        Publishing details
      </h2>
      <p className="mt-1 text-xs leading-relaxed text-default-600">
        Where the blog is filed. {requirement}
      </p>

      {address}

      <div className="mt-5">
        <label
          htmlFor={`${idPrefix}-category`}
          className="mb-1.5 block text-[0.8125rem] font-medium text-default-600"
        >
          Category
        </label>
        <CategoryPicker
          id={`${idPrefix}-category`}
          categories={categories}
          value={category}
          onChange={onCategoryChange}
          isLoading={categoriesLoading}
          error={categoriesError}
          onRetry={onRetryCategories}
          isInvalid={Boolean(categoryError)}
          errorMessage={categoryError}
          onRequest={onRequestCategory}
          extras={requestedCategories}
          selectedName={categorySelectedName}
        />
      </div>

      <div className="mt-5">
        <label
          htmlFor={`${idPrefix}-tags`}
          className="mb-1.5 block text-[0.8125rem] font-medium text-default-600"
        >
          Tags
        </label>
        <TagInput
          id={`${idPrefix}-tags`}
          tags={tags}
          onChange={onTagsChange}
          input={tagInput}
          onInputChange={onTagInputChange}
          suggestions={tagSuggestions}
          invalid={Boolean(tagsError)}
          onTagsRejected={onTagsRejected}
        />
        {tagsError ? (
          <FieldError className="mt-1.5">{tagsError}</FieldError>
        ) : (
          <p className="mt-1.5 text-xs text-default-600">
            Up to 8, separated by commas.
          </p>
        )}
      </div>

      {footer}
    </aside>
  );

  // An address that lives in its own section, with its own heading, reads as
  // the change it is: a different URL for something already published.
  if (!slugTitle) return details;

  return (
    <div>
      <section aria-labelledby={`${idPrefix}-address-title`}>
        <h2
          id={`${idPrefix}-address-title`}
          className="text-[0.8125rem] font-medium text-foreground"
        >
          {slugTitle}
        </h2>
        <div className="mt-4">{address}</div>
      </section>
      {details}
    </div>
  );
};

/**
 * The actions under the piece, for a writer who has just finished it.
 *
 * They repeat the bar on purpose: after a long article the next step should be
 * where the eye already is, not a scroll back to the top.
 */
export const BottomActions = ({
  note,
  previewHref,
  onPreview,
  primary,
}: {
  note: ReactNode;
  previewHref?: { href: string; label: string };
  onPreview: () => void;
  primary: ReactNode;
}) => (
  <div
    className={`${MEASURE} mt-12 flex flex-col gap-3 border-t border-default-200 pt-5 sm:flex-row sm:items-center sm:justify-between`}
  >
    <p className="text-sm text-default-600">{note}</p>
    <div className="flex flex-wrap items-center gap-2">
      {previewHref && (
        <Button
          as={Link}
          href={previewHref.href}
          target="_blank"
          rel="noopener noreferrer"
          variant="light"
          startContent={<LuExternalLink className="size-4" />}
        >
          {previewHref.label}
        </Button>
      )}
      <Button
        variant="bordered"
        startContent={<LuEye className="size-4" />}
        onPress={onPreview}
      >
        Preview
      </Button>
      {primary}
    </div>
  </div>
);

export const COMMON_TAGS = [
  "javascript",
  "typescript",
  "react",
  "nextjs",
  "nodejs",
  "css",
  "tailwindcss",
  "mongodb",
  "express",
  "tutorial",
  "beginners",
  "webdev",
];

export const FieldError = ({
  children,
  id,
  className = "",
}: {
  children: ReactNode;
  id?: string;
  className?: string;
}) => (
  <p id={id} role="alert" className={`text-xs text-danger ${className}`}>
    {children}
  </p>
);

/**
 * A state word with a mark.
 *
 * The mark only exists where the word is about state that matters (unsaved,
 * saved, failed); there is no dot on a heading, and nothing pulses.
 */
export const StatusMark = ({ tone }: { tone: "ok" | "warn" | "error" }) => (
  <span
    aria-hidden
    className={`size-2 shrink-0 rounded-full ${
      tone === "ok"
        ? "bg-success"
        : tone === "warn"
          ? "bg-warning"
          : "bg-danger"
    }`}
  />
);

/** Shown while a save is in flight, over the page rather than in place of it. */
export const SavingOverlay = ({ label }: { label: string }) => (
  <div className="fixed inset-0 z-[1111] flex items-center justify-center bg-background/70">
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-[10px] border border-default-200 bg-content1 px-4 py-3 text-sm"
    >
      <Spinner size="sm" />
      {label}
    </div>
  </div>
);

/**
 * The article's reading time, at the pace the published page uses.
 */
const readingMinutes = (html: string) => {
  const words = html
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return words ? Math.max(1, Math.round(words / 220)) : null;
};

/**
 * How the piece will read, in the article page's own typography.
 *
 * The header is the published one, in its order and its type: the category
 * pill, the title in the article face, the metadata line, the cover at its
 * published height, then the body inside `prose`. The numbers come from the
 * blog being edited, and the composer shows none, because a draft has none yet.
 * Both screens preview from here with the same fields, so what a writer checks
 * in the composer is what they check in the editor.
 */
export const PreviewModal = ({
  isOpen,
  onOpenChange,
  blog,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  blog: {
    title: string;
    content: string;
    tags: string[];
    /** The category's name, already resolved by the screen. */
    category?: string;
    coverUrl?: string | null;
    authorName?: string;
    createdAt?: string;
    totalViews?: number;
    totalComments?: number;
  };
}) => {
  const minutes = readingMinutes(blog.content);
  const date = formatBlogDate(blog.createdAt);

  return (
    <Modal
      scrollBehavior="inside"
      placement="top"
      size="full"
      classNames={{
        base: "mt-[var(--header-height)] h-[calc(100dvh-var(--header-height))] max-h-[calc(100dvh-var(--header-height))] overflow-hidden rounded-none rounded-b-[14px]",
      }}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-default-200 text-[0.8125rem] font-medium text-default-600">
              <LuEye aria-hidden className="size-4" />
              Preview
              <span aria-hidden className="text-default-300">
                ·
              </span>
              <span className="font-normal text-default-600">
                Readers will not see this until it is saved.
              </span>
            </ModalHeader>
            <ModalBody className={`py-8 ${FRAME_GUTTERS}`}>
              <article className="mx-auto w-full max-w-read">
                <header className="space-y-5">
                  {blog.category && (
                    <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-1 tth-label-sm text-primary-accessible">
                      {blog.category}
                    </span>
                  )}

                  {/* The published headline is the editorial face, as it is on the article page. */}
                  <h1 className="text-pretty font-[family-name:var(--type-editorial)] text-[1.9rem] font-semibold leading-[1.1] tracking-[-0.015em] sm:text-[2.4rem] lg:text-[2.75rem]">
                    {blog.title.trim() || "Untitled"}
                  </h1>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-default/60 pb-5 text-xs text-default-600">
                    {blog.authorName && (
                      <span className="text-sm font-semibold text-foreground">
                        {blog.authorName}
                      </span>
                    )}
                    {date && <time dateTime={blog.createdAt}>{date}</time>}
                    {minutes && <span>{minutes} min read</span>}
                    {typeof blog.totalViews === "number" && (
                      <span className="tabular-nums">
                        {blog.totalViews.toLocaleString()}{" "}
                        {blog.totalViews === 1 ? "view" : "views"}
                      </span>
                    )}
                    {typeof blog.totalComments === "number" && (
                      <span className="tabular-nums">
                        {blog.totalComments.toLocaleString()}{" "}
                        {blog.totalComments === 1 ? "comment" : "comments"}
                      </span>
                    )}
                  </div>
                </header>

                {blog.coverUrl && (
                  <div className="mt-6 h-56 overflow-hidden rounded-xl bg-default-100 sm:h-72 lg:h-80">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={blog.coverUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  </div>
                )}

                <div className="prose prose-neutral mt-8 max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-primary-accessible prose-img:rounded-lg">
                  {blog.content ? (
                    <div dangerouslySetInnerHTML={{ __html: blog.content }} />
                  ) : (
                    <p className="text-default-600">
                      Nothing written yet. The body appears here as readers will
                      see it.
                    </p>
                  )}
                </div>

                {blog.tags.length > 0 && (
                  <div className="mt-10 flex flex-wrap gap-2">
                    {blog.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-default-100 px-2.5 py-1 text-xs text-default-700"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            </ModalBody>
            <ModalFooter className="border-t border-default-200">
              <p className="mr-auto hidden text-xs text-default-600 sm:block">
                The article page adds sharing, votes and comments under the
                body.
              </p>
              <Button variant="light" onPress={onClose}>
                Close preview
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

/**
 * The blog's category as a name, for the preview.
 *
 * The API returns the category populated on most reads, but an id on some, so
 * both are accepted: an id is resolved against the loaded list rather than
 * printed to the writer, and an unknown one shows nothing at all. The list also
 * holds the writer's own requests, which have no stored category of their own.
 */
export const categoryName = (
  blog: { category?: ICategory | string | null },
  categories: { id?: string; _id?: string; name: string }[],
) => {
  const stored = (item: { id?: string; _id?: string; name: string }) => ({
    name: item.name,
    id: item.id ?? item._id ?? "",
  });

  const value = blog.category;
  if (!value) return undefined;
  if (typeof value === "string") {
    return (
      categories.map(stored).find((item) => item.id === value)?.name ??
      undefined
    );
  }
  return (
    value.name ||
    categories.map(stored).find((item) => item.id === value._id)?.name
  );
};
