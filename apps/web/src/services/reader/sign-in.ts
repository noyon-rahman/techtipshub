"use server";

import { afterSignInPath, safeRedirectPath } from "@/lib/blog-routes";
import { readReaderSession } from "@/lib/reader-session";
import { readInterests } from "./interests";
import { readUsernameOnboarding } from "./username";

/**
 * Where a browser that just signed in should land.
 *
 * Runs as a server action straight after a successful sign-in, while the new
 * session cookie is in the request. A member who has not confirmed their handle
 * goes to the username step first, then the interests step, and is sent on to
 * `destination` afterwards; everyone else goes straight through.
 *
 * If an answer cannot be read, that step is skipped for this sign-in. Being
 * asked one extra time on a later visit is a smaller fault than blocking a
 * sign-in behind a failed call, and the API still holds both answers.
 */
export const afterSignInAction = async (
  destination: string,
): Promise<string> => {
  const safe = safeRedirectPath(destination);

  const { accessToken } = await readReaderSession();
  const [username, interests] = await Promise.all([
    readUsernameOnboarding(accessToken),
    readInterests(accessToken),
  ]);

  return afterSignInPath(safe, {
    onboarded: username.success
      ? username.data?.onboarded === true
      : true,
    interestsAnswered: interests.success
      ? interests.data?.answered === true
      : true,
  });
};
