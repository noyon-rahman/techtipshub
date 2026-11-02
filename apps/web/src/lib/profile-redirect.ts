import "server-only";

import { publicProfilePath } from "@/lib/blog-routes";
import { findCurrentHandle } from "@/services/reader/current-handle";
import { permanentRedirect } from "next/navigation";

/**
 * Send a visitor who followed an old handle to the member's current one.
 *
 * A rename breaks every link to the profile that was saved before it: shared
 * addresses, bookmarks, the sitemap, and the ranking the page earned. The API
 * keeps each retired handle in `username_history` for a year, and this turns
 * one into a permanent redirect, so a search engine moves the value to the new
 * address instead of dropping the page.
 *
 * `suffix` is the rest of the address as it arrived (`""`, `/followers`,
 * `/following`), so a reader lands on the same part of the profile they asked
 * for rather than being sent back to the top of it.
 *
 * A handle nobody ever held is left alone: the caller renders its own "not
 * found" page, which is the truth for a mistyped address.
 */
export const redirectRetiredHandle = async (
  handle: string,
  suffix = "",
) => {
  const current = await findCurrentHandle(handle);

  if (!current || current === handle) return;

  permanentRedirect(`${publicProfilePath(current)}${suffix}`);
};
