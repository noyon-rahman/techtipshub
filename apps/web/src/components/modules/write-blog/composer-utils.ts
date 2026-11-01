/**
 * Types and helpers for the blog composer.
 *
 * Everything here is presentation-independent: it turns a draft into the
 * `FormData` the API expects, validates it, and keeps a local copy so a
 * reload does not throw the draft away.
 */

import { ARTICLE_ACCESS, type TArticleAccess } from "@techtipshub/shared";
import { ARTICLE_TOO_LARGE, COVER_MAX_BYTES } from "@/lib/upload-limits";

export interface BlogFormValues {
  title: string;
  content: string;
  category: string;
  tags: string[];
  /** Who can read it once published. Always one of the two, never unset. */
  access: TArticleAccess;
}

export interface BlogFormData extends BlogFormValues {
  /** Optional short description, rendered as the article's subtitle. */
  description?: string;
  /**
   * What the chosen category is called, kept only so a restored draft can show
   * it: a category request has no other record once the page reloads.
   */
  categoryName?: string;
}

export type DraftField = "title" | "content" | "category" | "tags" | "cover";

export const EMPTY_DRAFT: BlogFormData = {
  title: "",
  content: "",
  category: "",
  tags: [],
  description: "",
  // The setting every article had before it was a choice.
  access: ARTICLE_ACCESS.MEMBERS,
};

const DRAFT_KEY = "tth:write-blog:draft";

/** True once the draft holds anything worth keeping: text, details or a cover. */
export const hasDraftContent = (values: BlogFormData) => {
  const body = values.content.replace(/<[^>]+>/g, "").trim();
  return Boolean(
    values.title.trim() ||
    values.description?.trim() ||
    body ||
    values.category ||
    values.tags.length,
  );
};

/**
 * Where this draft's cover is kept. A stored cover is only shown while the rest
 * of the draft is still the same, so a recalled image can never be attached to
 * a blog the writer did not choose it for.
 */
export const draftCoverKey = (values: BlogFormData) => {
  const text = values.title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return `draft:${text}`;
};

/** Everything in the draft that a reload must bring back. */
export const draftFingerprint = (values: BlogFormData) =>
  JSON.stringify({
    title: values.title,
    content: values.content,
    category: values.category,
    categoryName: values.categoryName ?? "",
    tags: values.tags,
    description: values.description ?? "",
    access: values.access,
  });

/** True when the value is empty HTML such as `<p></p>`. */
export const isBlankContent = (html: string) => {
  if (!html) return true;
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent ?? "").trim() === "" && !div.querySelector("img,hr");
};

/**
 * Checks a draft before publishing.
 *
 * Returns the fields that need attention, in the order the form shows them, so
 * the caller can point at the first one instead of failing silently.
 *
 * `hasCover` is required because the API will not create a blog without one
 * (`coverImage` is a required field on the model), so this is the first place a
 * writer can be told, rather than the server bouncing a finished drafts.
 */
export const validateDraft = (values: BlogFormData, hasCover: boolean) => {
  const errors: Partial<Record<DraftField, string>> = {};

  if (!values.title.trim()) errors.title = "Give the blog a title.";
  else if (values.title.trim().length < 4)
    errors.title = "The title needs at least 4 characters.";

  if (!hasCover) errors.cover = "Add a cover image. Every blog needs one.";

  if (isBlankContent(values.content)) errors.content = "Write some content.";

  if (!values.category) errors.category = "Choose a category.";

  if (!values.tags.length) errors.tags = "Add at least one tag.";

  return errors;
};

const CANCELLED = /cancelled|canceled|err_cancel/i;

/**
 * The message to show for a failed create or update.
 *
 * The hooks surface the API's message as the thrown error, but a request the
 * caller cancelled reaches here as a bare abort. Naming the cancellation is
 * truer than "something went wrong", and the content is still on screen either
 * way.
 */
export const describeFailure = (error: unknown, fallback: string) => {
  // The proxy and the host answer an oversized body with a 413 whose text is
  // either empty or the platform's own wording. Saying it in words the writer
  // can use is the whole point of catching it here. The cover is uploaded
  // before this point, so what was too big is the article itself.
  const status = (error as { response?: { status?: number } } | null)?.response
    ?.status;
  if (status === 413) return ARTICLE_TOO_LARGE;

  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return raw && !CANCELLED.test(raw) ? raw : fallback;
};

/**
 * What the article sent as JSON will weigh, in bytes, before it is sent.
 *
 * The cover is no longer part of this body (it is already a URL), so the cap
 * only has to hold the article itself; a long piece is what gets near it.
 */
export const payloadSizeBytes = (values: BlogFormData) => {
  const article = JSON.stringify({
    title: values.title,
    content: values.content,
    category: values.category,
    tags: values.tags,
    description: values.description ?? "",
    access: values.access,
  });
  return new TextEncoder().encode(article).byteLength;
};

/**
 * The message to show when a publish would carry too much, or null.
 *
 * Only the article is measured now: the cover is uploaded on its own and costs
 * the article body a URL, so a large cover can no longer be the reason a
 * publish is refused.
 */
export const validateUploadSize = (values: BlogFormData): string | null => {
  if (payloadSizeBytes(values) > COVER_MAX_BYTES) {
    return ARTICLE_TOO_LARGE;
  }
  return null;
};

/**
 * The `data` object `POST /blogs` and `PUT /blogs/:id` accept, as JSON.
 *
 * The schema is `.strict()` and the Post model has no `description` field, so
 * any extra key fails validation with a 400. The composer's description stays
 * a local draft field rather than a stored column.
 *
 * `coverImage` is the Cloudinary URL from the signed upload, and it may be left
 * out: on an update that means "keep the one stored now".
 */
export const buildBlogJson = (
  values: BlogFormData,
  coverImageUrl?: string | null,
  extra?: Record<string, unknown>,
): Record<string, unknown> => ({
  title: values.title.trim(),
  content: values.content,
  category: values.category,
  tags: values.tags,
  contentType: "html",
  access: values.access,
  ...(coverImageUrl ? { coverImage: coverImageUrl } : {}),
  ...extra,
});

/**
 * Builds the multipart body for `POST /admin/blogs`.
 *
 * The admin composer still sends the cover as a file, because the admin
 * endpoints keep the multipart upload. `extra` carries the fields only the
 * admin create accepts: whose byline the article has and whether it goes live.
 */
export const buildBlogPayload = (
  values: BlogFormData,
  coverImage: File | null,
  extra?: Record<string, unknown>,
) => {
  const formData = new FormData();
  if (coverImage) formData.append("image", coverImage);

  formData.append("data", JSON.stringify(buildBlogJson(values, null, extra)));
  return formData;
};

/**
 * Builds the JSON body for `PUT /blogs/:id`.
 *
 * An update that carries no URL leaves `coverImage` out, which is how the API
 * is told to keep the stored cover rather than to clear it.
 */
export const buildUpdateJson = (
  values: BlogFormData,
  coverImageUrl?: string | null,
  extra?: Record<string, unknown>,
) => buildBlogJson(values, coverImageUrl, extra);

/**
 * Builds the multipart body for `PUT /admin/blogs/:id`.
 *
 * Only the fields the update schema accepts: it is `.strict()`, so any other
 * key (an `id`, a `description`) fails the whole request with a 400.
 */
export const buildUpdatePayload = (
  values: BlogFormData,
  coverImage: File | null,
  extra?: Record<string, unknown>,
) => {
  const formData = new FormData();

  formData.append("data", JSON.stringify(buildBlogJson(values, null, extra)));

  // Appending the file is what tells the API to replace the stored cover;
  // omitting it leaves the current one alone.
  if (coverImage) formData.append("image", coverImage);

  return formData;
};

/** Plain words in the body, for the live word count. */
export const wordCount = (html: string) => {
  const text = html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text ? text.split(/\s+/).length : 0;
};

interface StoredDraft {
  values: BlogFormData;
  savedAt: number;
}

/** How long an unedited draft (and its cover) stays recoverable. */
const DRAFT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/** Reads the locally saved draft, if there is one. */
export const loadDraft = (): StoredDraft | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed?.values) return null;
    if (Date.now() - Number(parsed.savedAt) > DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return { ...parsed, values: { ...EMPTY_DRAFT, ...parsed.values } };
  } catch {
    return null;
  }
};

export const saveDraft = (values: BlogFormData) => {
  try {
    window.localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ values, savedAt: Date.now() } satisfies StoredDraft),
    );
  } catch {
    // Quota exceeded (a pasted image can be large) - autosave is best-effort.
  }
};

export const clearDraft = () => {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Ignore: nothing to recover.
  }
};

/** Human wording for "saved a moment ago" style labels. */
export const formatSavedAt = (timestamp: number) => {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "Saved just now";
  if (seconds < 60) return `Saved ${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `Saved ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `Saved ${hours} h ago` : "Saved earlier";
};
