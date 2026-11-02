import envConfig from "@/config/env.config";
import { legacyResponse } from "@/lib/api-contract";
import type { TLegacyBody } from "@/lib/api-contract";
import type { IReaderInterests } from "@techtipshub/shared";

/**
 * The reader's interests, from their own session.
 *
 * Both calls answer with `IReaderInterests`, so a screen reads the saved list
 * from the API's answer rather than keeping its own copy of what was picked.
 * The token is spent here and never reaches the browser.
 *
 * Nothing is cached: this is per-reader, and a page that shows it is the page
 * the reader is editing it on.
 */

const interestUrl = () => new URL(`${envConfig.baseApi}/users/interests`);

const withToken = (accessToken?: string): Record<string, string> =>
  accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

export const readInterests = async (
  accessToken?: string,
): Promise<TLegacyBody<IReaderInterests>> => {
  if (!accessToken) {
    return { success: false, message: "Sign in to choose what you read." };
  }

  try {
    const res = await fetch(interestUrl().toString(), {
      cache: "no-store",
      headers: withToken(accessToken),
    });

    const body = await legacyResponse<IReaderInterests>(res);

    return body ?? { success: false, message: "Interests did not load." };
  } catch {
    return { success: false, message: "Interests did not load." };
  }
};

/**
 * Save the reader's choice, or their skip.
 *
 * An empty list is a real answer, and it is what the skip sends: the API marks
 * the step as answered either way. That is why there is one call for both
 * buttons rather than a separate "skip" request.
 */
export const saveInterests = async (
  interests: string[],
  accessToken?: string,
): Promise<TLegacyBody<IReaderInterests>> => {
  if (!accessToken) {
    return { success: false, message: "Sign in to choose what you read." };
  }

  try {
    const res = await fetch(interestUrl().toString(), {
      method: "PUT",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...withToken(accessToken),
      },
      body: JSON.stringify({ interests }),
    });

    const body = await legacyResponse<IReaderInterests>(res);

    return body ?? { success: false, message: "Your interests were not saved." };
  } catch {
    return { success: false, message: "Your interests were not saved." };
  }
};

/**
 * The reader's own identity details, for screens that address them by name.
 *
 * Read from the API's account answer, never from the renderer's idea of who is
 * signed in. Either field may be missing (a did-not-load); callers treat that
 * as "leave the name out", because neither is worth blocking a screen over.
 */
export const readReaderIdentity = async (
  accessToken?: string,
): Promise<{ firstName: string | null; username: string | null }> => {
  if (!accessToken) return { firstName: null, username: null };

  try {
    const res = await fetch(new URL(`${envConfig.baseApi}/auth/me`).toString(), {
      cache: "no-store",
      headers: withToken(accessToken),
    });

    const body = await legacyResponse<{ fullName?: string; username?: string }>(
      res,
    );

    return {
      firstName: body?.data?.fullName?.trim().split(/\s+/)[0] || null,
      username: body?.data?.username || null,
    };
  } catch {
    return { firstName: null, username: null };
  }
};

/** The reader's first name, for the welcome greeting. */
export const readReaderFirstName = async (
  accessToken?: string,
): Promise<string | null> => (await readReaderIdentity(accessToken)).firstName;

/** The reader's handle, for a link to their own profile. */
export const readReaderUsername = async (
  accessToken?: string,
): Promise<string | null> => (await readReaderIdentity(accessToken)).username;
