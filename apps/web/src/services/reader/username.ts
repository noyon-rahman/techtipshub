"use server";

import envConfig from "@/config/env.config";
import { legacyResponse } from "@/lib/api-contract";
import type { TLegacyBody } from "@/lib/api-contract";
import type {
  IUsernameAvailability,
  IUsernameChangeState,
  IUsernameOnboardingState,
} from "@techtipshub/shared";

/**
 * The username step and the handle rules, from the reader's own session.
 *
 * The step sits on a prerendered page and the token is an httpOnly cookie the
 * browser cannot read, so every call here is a server action: the token is read
 * on the server, spent on the API and left out of the answer.
 *
 * Nothing is cached. This is one reader's account, and the page that shows it
 * is the page they are changing it on.
 */

const usernameUrl = (path: string) =>
  new URL(`${envConfig.baseApi}/users/username/${path}`).toString();

const withToken = (accessToken?: string): Record<string, string> =>
  accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

const SIGNED_OUT = "Sign in to choose your username.";

async function read<T>(
  path: string,
  accessToken: string | undefined,
  missing: string,
): Promise<TLegacyBody<T>> {
  if (!accessToken) return { success: false, message: SIGNED_OUT };

  try {
    const res = await fetch(usernameUrl(path), {
      cache: "no-store",
      headers: withToken(accessToken),
    });

    return (
      (await legacyResponse<T>(res)) ?? { success: false, message: missing }
    );
  } catch {
    return { success: false, message: missing };
  }
}

/** The handle to offer, and whether the step still has anything to ask. */
export const readUsernameOnboarding = async (accessToken?: string) =>
  read<IUsernameOnboardingState>(
    "onboarding",
    accessToken,
    "Your username did not load.",
  );

/**
 * Whether a typed handle can be claimed.
 *
 * The value is sent as typed, because a half-typed handle is exactly what the
 * form needs an answer for ("too short" rather than a refused request).
 */
export const checkUsernameAvailability = async (
  username: string,
  accessToken?: string,
): Promise<TLegacyBody<IUsernameAvailability>> => {
  if (!accessToken) return { success: false, message: SIGNED_OUT };

  try {
    const url = new URL(usernameUrl("availability"));
    url.searchParams.set("username", username);

    const res = await fetch(url.toString(), {
      cache: "no-store",
      headers: withToken(accessToken),
    });

    return (
      (await legacyResponse<IUsernameAvailability>(res)) ?? {
        success: false,
        message: "That name could not be checked.",
      }
    );
  } catch {
    return { success: false, message: "That name could not be checked." };
  }
};

/**
 * Change the handle from the profile.
 *
 * The profile update endpoint carries one field's worth of rule, and the API
 * decides it: the lock, the shape and the retired handle all live there. This
 * sends the one field and reports the answer, so the profile form and the
 * handle press cannot disagree about what is allowed.
 */
export const changeUsername = async (
  username: string,
  accessToken?: string,
): Promise<TLegacyBody<IUsernameChangeState>> => {
  if (!accessToken) return { success: false, message: SIGNED_OUT };

  try {
    const res = await fetch(`${envConfig.baseApi}/users/update-profile`, {
      method: "PATCH",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...withToken(accessToken),
      },
      body: JSON.stringify({ username }),
    });

    return (
      (await legacyResponse<IUsernameChangeState>(res)) ?? {
        success: false,
        message: "Your username was not changed.",
      }
    );
  } catch {
    return {
      success: false,
      message: "Your username was not changed. Try again in a moment.",
    };
  }
};

/** Record the choice. The API owns whether it is allowed and what it stores. */
export const completeUsernameOnboarding = async (
  username: string,
  accessToken?: string,
): Promise<TLegacyBody<IUsernameChangeState & { onboarded: boolean }>> => {
  if (!accessToken) return { success: false, message: SIGNED_OUT };

  try {
    const res = await fetch(usernameUrl("onboarding"), {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...withToken(accessToken),
      },
      body: JSON.stringify({ username }),
    });

    return (
      (await legacyResponse<IUsernameChangeState & { onboarded: boolean }>(
        res,
      )) ?? { success: false, message: "Your username was not saved." }
    );
  } catch {
    return { success: false, message: "Your username was not saved." };
  }
};

/** The lock, as this member stands under it, for the profile's handle field. */
export const readUsernameState = async (accessToken?: string) =>
  read<IUsernameChangeState>(
    "state",
    accessToken,
    "Your username did not load.",
  );
