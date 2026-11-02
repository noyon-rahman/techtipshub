"use server";

import { revalidatePath } from "next/cache";
import { readReaderSession, logAfterResponse } from "@/lib/reader-session";
import { readInterests, readReaderFirstName, saveInterests } from "./interests";
import {
  changeUsername,
  checkUsernameAvailability,
  completeUsernameOnboarding,
  readUsernameOnboarding,
} from "./username";

/**
 * The interests step, called from the browser.
 *
 * A server action because the answer depends on the request that is reading:
 * the page that asks is prerendered and shared, and the token is an httpOnly
 * cookie the browser cannot read. The token is read here, spent on the API, and
 * left out of the answer.
 */

export const readInterestsAction = async () => {
  const { accessToken } = await readReaderSession();

  return readInterests(accessToken);
};

/**
 * Everything the welcome step asks after load: the saved topics, and the name
 * for the greeting. One action so the page holds one request; the greeting
 * degrades on its own if the name does not come back.
 */
export const readWelcomeStateAction = async () => {
  const { accessToken } = await readReaderSession();

  const [interests, firstName] = await Promise.all([
    readInterests(accessToken),
    readReaderFirstName(accessToken),
  ]);

  return { interests, firstName };
};

/**
 * Save the reader's pick, or the skip that sends an empty list.
 *
 * The whole list is sent every time, so this is the same call whether it came
 * from the interests step or from the profile, and the API ends up holding what
 * the reader last saw ticked.
 */
export const saveInterestsAction = async (interests: string[]) => {
  const { accessToken } = await readReaderSession();

  const result = await saveInterests(
    interests.filter((id) => typeof id === "string"),
    accessToken,
  );

  if (!result.success) {
    logAfterResponse("interests", result.message);
  }

  return result;
};

/**
 * The username step, called from the browser for the same reason as the
 * interests step: the page is prerendered and the token is an httpOnly cookie.
 */

export const readUsernameOnboardingAction = async () => {
  const { accessToken } = await readReaderSession();

  return readUsernameOnboarding(accessToken);
};

export const checkUsernameAvailabilityAction = async (username: string) => {
  const { accessToken } = await readReaderSession();

  return checkUsernameAvailability(username, accessToken);
};

/**
 * Change the handle from the profile, on its own.
 *
 * The handle is saved by its own press rather than with the profile form: it is
 * the one field with a rule attached (a 30 day wait, a reservation, a public
 * address that moves), so its answer is its own, and a refused handle cannot
 * take the rest of a profile edit down with it. The API owns the rule; this
 * only carries the answer back.
 */
export const changeUsernameAction = async (username: string) => {
  const { accessToken } = await readReaderSession();

  const result = await changeUsername(username, accessToken);

  if (!result.success) {
    logAfterResponse("username-change", result.message);
  } else {
    // The page behind carries the handle in its header and its share link, and
    // the article list addresses it too.
    revalidatePath("/profile");
  }

  return result;
};

export const completeUsernameOnboardingAction = async (username: string) => {
  const { accessToken } = await readReaderSession();

  const result = await completeUsernameOnboarding(username, accessToken);

  if (!result.success) {
    logAfterResponse("username-onboarding", result.message);
  }

  return result;
};
