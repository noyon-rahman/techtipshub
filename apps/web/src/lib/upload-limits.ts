/**
 * One size limit for every image a member uploads.
 *
 * Vercel refuses a request body over 4.5 MB before it reaches the app, and the
 * budget has to cover the multipart envelope as well as the file: boundaries,
 * the article JSON, the part names. 4 MB leaves about half a megabyte for that
 * and still stays under the host's cap.
 *
 * The server actions that take a cover or a photo are held to the same number
 * in `next.config.js`, so a file the picker accepts cannot be refused later by
 * a limit the writer was never told about.
 *
 * Free of server and React imports so a client component, a route handler and
 * the config file can all read it.
 */
export const IMAGE_MAX_BYTES = 4 * 1024 * 1024;

/** The same limit for an article's cover, named for the place it applies. */
export const COVER_MAX_BYTES = IMAGE_MAX_BYTES;

/**
 * The wording for a file that is too big.
 *
 * Shared rather than repeated so the pickers, the pre-publish check and the
 * proxy's 413 answer cannot drift into four different phrasings.
 */
export const COVER_TOO_LARGE =
  "That cover is too large. Use an image under 4 MB.";

/**
 * The wording for an article body past the cap. The cover is uploaded on its
 * own now, so a writer told this one has only the article to shorten.
 */
export const ARTICLE_TOO_LARGE =
  "This article is too large to publish. Shorten it.";

export const tooLargeForCoverUpload = (sizeBytes: number): boolean =>
  sizeBytes > COVER_MAX_BYTES;

export const imageTooLargeMessage = (label: "profile photo" | "avatar") =>
  `That ${label} is too large. Use an image under 4 MB.`;
