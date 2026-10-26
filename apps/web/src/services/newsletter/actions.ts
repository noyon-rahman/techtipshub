"use server";

import { cookies } from "next/headers";
import { baseApi } from "@/config/api";
import {
  getNewsletterMembership,
  readUnsubscribeLink,
  setNewsletterMembership,
  subscribeToNewsletter,
  unsubscribeFromNewsletter,
} from ".";
import type { TNewsletterResult } from "./types";

/**
 * The newsletter, called from forms.
 *
 * Everything here runs on the server, so the API origin is used directly and
 * its CORS allow-list cannot refuse the call. The two membership calls forward
 * the member's cookies explicitly, because a server action is its own request
 * and does not pass the page's cookies on to the API.
 */

const forwardedCookie = async () => {
  const store = await cookies();

  return store
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
};

export const joinNewsletterAction = async (input: {
  name: string;
  email: string;
}): Promise<TNewsletterResult> => subscribeToNewsletter(baseApi, input);

export const readUnsubscribeAction = async (input: {
  email: string;
  token: string;
}) => readUnsubscribeLink(baseApi, input.email, input.token);

export const leaveNewsletterAction = async (input: {
  email: string;
  token: string;
}): Promise<TNewsletterResult> =>
  unsubscribeFromNewsletter(baseApi, input.email, input.token);

export const readMembershipAction = async () =>
  getNewsletterMembership(baseApi, await forwardedCookie());

export const saveMembershipAction = async (
  subscribed: boolean,
): Promise<TNewsletterResult> =>
  setNewsletterMembership(baseApi, subscribed, await forwardedCookie());
