import { legacyResponse } from "@/lib/api-contract";

/**
 * The newsletter from a reader's side, without a session: joining from a form,
 * and leaving from a link.
 *
 * These run on the server (the forms call them through server actions), so the
 * API origin is used directly. Every call resolves to `{ success, message }`
 * rather than throwing: the API's own failure message is what the reader sees.
 *
 * `cookie` is forwarded when a call needs the member's session; a server action
 * does not pass its request's cookies on by itself.
 */

type THeaders = { cookie?: string };

const post = async (
  base: string,
  path: string,
  body: unknown,
  fallback: string,
  headers: THeaders = {},
): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(headers.cookie ? { cookie: headers.cookie } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });

    const payload = await legacyResponse<{ message?: string }>(res, fallback);

    return {
      success: res.ok,
      message: payload?.message || (res.ok ? "" : fallback),
    };
  } catch {
    return {
      success: false,
      message: "Network error. Please check your connection and try again.",
    };
  }
};

/**
 * Join the list. Single opt-in: one request, and the welcome mail is the
 * receipt. The API answers the same words whether the address just joined or
 * was already there, so the form cannot be used to look people up.
 */
export const subscribeToNewsletter = async (
  base: string,
  payload: { name: string; email: string },
) =>
  post(
    base,
    "/newsletter",
    payload,
    "You could not be added to the list. Please try again shortly.",
  );

/** Whose address an unsubscribe link is about, before anything is removed. */
export const readUnsubscribeLink = async (
  base: string,
  email: string,
  token: string,
) => {
  const query = new URLSearchParams({ email, token });

  try {
    const res = await fetch(`${base}/newsletter/unsubscribe?${query}`, {
      cache: "no-store",
    });

    const payload = await legacyResponse<{ email?: string }>(res);

    if (!res.ok) {
      return {
        valid: false as const,
        message:
          payload?.message ||
          "This unsubscribe link is not valid. Check the link in your email.",
      };
    }

    return { valid: true as const, address: payload?.data?.email ?? email };
  } catch {
    return {
      valid: false as const,
      message: "We could not reach the server. Please try the link again.",
    };
  }
};

/** Remove the address the link names. Safe to press twice. */
export const unsubscribeFromNewsletter = async (
  base: string,
  email: string,
  token: string,
) =>
  post(
    base,
    "/newsletter/unsubscribe",
    { email, token },
    "You could not be unsubscribed. Please try again shortly.",
  );

/* -------------------------------------------------------------- the switch */

export type TMembership = {
  success: boolean;
  subscribed: boolean;
  /** The raw list status, for the one case the switch cannot offer. */
  status: string | null;
  message: string;
};

/** Whether the signed-in account is on the list. */
export const getNewsletterMembership = async (
  base: string,
  cookie = "",
): Promise<TMembership> => {
  try {
    const res = await fetch(`${base}/newsletter/membership`, {
      headers: cookie ? { cookie } : undefined,
      cache: "no-store",
    });

    const payload = await legacyResponse<{
      subscribed: boolean;
      status: string | null;
    }>(res);

    if (!res.ok) {
      return {
        success: false,
        subscribed: false,
        status: null,
        message:
          payload?.message || "Your newsletter setting did not load.",
      };
    }

    return {
      success: true,
      subscribed: Boolean(payload?.data?.subscribed),
      status: payload?.data?.status ?? null,
      message: "",
    };
  } catch {
    return {
      success: false,
      subscribed: false,
      status: null,
      message: "Your newsletter setting did not load.",
    };
  }
};

/** Moving the profile switch. */
export const setNewsletterMembership = async (
  base: string,
  subscribed: boolean,
  cookie = "",
): Promise<{ success: boolean; message: string }> => {
  try {
    const res = await fetch(`${base}/newsletter/membership`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ subscribed }),
      cache: "no-store",
    });

    const payload = await legacyResponse<{ message?: string }>(
      res,
      "Your newsletter setting was not saved.",
    );

    return {
      success: res.ok,
      message:
        payload?.message ||
        (res.ok ? "" : "Your newsletter setting was not saved."),
    };
  } catch {
    return {
      success: false,
      message: "Your newsletter setting was not saved.",
    };
  }
};
