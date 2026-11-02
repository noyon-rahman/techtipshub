import "server-only";

import envConfig from "@/config/env.config";
import { legacyResponse } from "@/lib/api-contract";

/**
 * Where an old handle points now, asked by a page that is rendering.
 *
 * Public, so it is not a server action: the redirect pages call it while
 * rendering, and an action module may only export async functions the client
 * could invoke.
 *
 * `null` means the handle was never held, which the caller renders as not
 * found.
 */
export const findCurrentHandle = async (
  handle: string,
): Promise<string | null> => {
  const url = new URL(
    `${envConfig.baseApi}/users/username/current/${encodeURIComponent(handle)}`,
  ).toString();

  try {
    const res = await fetch(url, {
      // A redirect's target changes only when the member renames again, and the
      // rename revalidates the pages that show it.
      cache: "force-cache",
      next: { revalidate: 43200 },
    });

    const body = await legacyResponse<{ username: string } | null>(res);

    return body?.success ? (body.data?.username ?? null) : null;
  } catch {
    return null;
  }
};
