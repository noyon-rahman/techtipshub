import axiosInstance from "@/lib/AxiosInstance";
import {
  cleanFilter,
  readData,
  readMeta,
  readRows,
  toServiceError,
} from "./shared";

/**
 * Newsletter, admin side.
 *
 * Two subjects: the list of people, and the monthly issues sent to them. The
 * calls go through this app's `/api/admin` handler, which attaches the session
 * and forwards to the API (see `lib/AxiosInstance`).
 */

export type TSubscriberStatus =
  "active" | "unsubscribed" | "bounced" | "complained";

export type TSubscriberSource = "site" | "profile" | "admin";

export interface INewsletterSubscriber {
  _id: string;
  name: string;
  email: string;
  status: TSubscriberStatus;
  source: TSubscriberSource;
  consentAt: string;
  unsubscribedAt?: string | null;
  suppressedAt?: string | null;
  suppressReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface INewsletterCounts {
  active: number;
  unsubscribed: number;
  bounced: number;
  complained: number;
  total: number;
}

export interface INewsletterSubscribersParams {
  page?: number;
  limit?: number;
  status?: TSubscriberStatus | "all";
  source?: TSubscriberSource | "all";
  searchTerm?: string;
  sort?: string;
}

/** GET /admin/newsletter/subscribers */
export const getSubscribers = async (
  params: INewsletterSubscribersParams = {},
) => {
  try {
    const res = await axiosInstance.get("/admin/newsletter/subscribers", {
      params: cleanFilter(params),
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The subscriber list did not load.");
  }
};

const asCount = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
};

export const readSubscriberPage = (
  payload: unknown,
  params: INewsletterSubscribersParams = {},
) => {
  const rows = readRows<INewsletterSubscriber>(payload);
  const body = payload as { data?: { meta?: unknown; counts?: unknown } };
  const raw = body?.data?.counts as Partial<INewsletterCounts> | undefined;

  return {
    rows,
    meta: readMeta(payload, rows.length, params.page, params.limit),
    counts: {
      active: asCount(raw?.active),
      unsubscribed: asCount(raw?.unsubscribed),
      bounced: asCount(raw?.bounced),
      complained: asCount(raw?.complained),
      total: asCount(raw?.total),
    } satisfies INewsletterCounts,
  };
};

/** POST /admin/newsletter/subscribers */
export const addSubscriber = async (payload: {
  name: string;
  email: string;
  sendWelcome: boolean;
}) => {
  try {
    const res = await axiosInstance.post(
      "/admin/newsletter/subscribers",
      payload,
    );

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The subscriber was not added.");
  }
};

/**
 * POST /admin/newsletter/subscribers/unsubscribe
 *
 * The address rather than the row id: on the server this is the same act as
 * the reader's own unsubscribe link.
 */
export const removeSubscriber = async (email: string) => {
  try {
    const res = await axiosInstance.post(
      "/admin/newsletter/subscribers/unsubscribe",
      { email },
    );

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The subscriber was not removed.");
  }
};

/** DELETE /admin/newsletter/subscribers/:id */
export const deleteSubscriberPermanently = async (id: string) => {
  try {
    const res = await axiosInstance.delete(
      `/admin/newsletter/subscribers/${id}`,
    );

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The subscriber could not be deleted.");
  }
};

/**
 * The CSV, fetched as a blob so the browser saves a file rather than rendering
 * a wall of text. The API puts the date in the filename header.
 */
export const downloadSubscribersCsv = async () => {
  try {
    const res = await axiosInstance.get(
      "/admin/newsletter/subscribers/export",
      { responseType: "blob" },
    );

    return res.data as Blob;
  } catch (error) {
    throw toServiceError(error, "The export did not download.");
  }
};

/* ------------------------------------------------------------ campaigns */

export type TCampaignStatus = "draft" | "sending" | "sent";

export interface ICampaignArticle {
  blog: string;
  title: string;
  href: string;
  excerpt: string;
  coverImage: string;
  category: string;
}

export interface ICampaignSummary {
  _id: string;
  subject: string;
  heading: string;
  status: TCampaignStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdAt: string;
}

export interface ICampaign extends ICampaignSummary {
  preview: string;
  intro: string;
  articles: ICampaignArticle[];
  createdBy?: string | null;
}

export interface ICampaignProgress {
  _id: string;
  status: TCampaignStatus;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  startedAt?: string | null;
  finishedAt?: string | null;
  remaining: number;
}

export interface ICampaignArticlePick {
  _id: string;
  title: string;
  slug?: string;
  coverImage?: string;
  category: string;
  createdAt: string;
  href: string;
}

export interface ICampaignSuggestion {
  heading: string;
  since: string | null;
  lastSubject: string | null;
  articles: ICampaignArticlePick[];
}

export type TCampaignInput = {
  subject: string;
  preview: string;
  heading: string;
  intro: string;
  articleIds: string[];
};

/** GET /admin/newsletter/campaigns */
export const getCampaigns = async (
  params: { page?: number; limit?: number } = {},
) => {
  try {
    const res = await axiosInstance.get("/admin/newsletter/campaigns", {
      params: cleanFilter(params),
    });

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The issues did not load.");
  }
};

export const readCampaignPage = (
  payload: unknown,
  params: { page?: number; limit?: number } = {},
) => {
  const rows = readRows<ICampaignSummary>(payload);

  return {
    rows,
    meta: readMeta(payload, rows.length, params.page, params.limit),
  };
};

/** GET /admin/newsletter/campaigns/suggestion */
export const getCampaignSuggestion = async () => {
  try {
    const res = await axiosInstance.get(
      "/admin/newsletter/campaigns/suggestion",
    );

    return readData(res.data, "The article picks did not load.") as
      ICampaignSuggestion | undefined;
  } catch (error) {
    throw toServiceError(error, "The article picks did not load.");
  }
};

/** GET /admin/newsletter/campaigns/:id */
export const getCampaign = async (id: string) => {
  try {
    const res = await axiosInstance.get(`/admin/newsletter/campaigns/${id}`);

    return readData(res.data, "The issue did not load.") as
      { campaign: ICampaign; progress: ICampaignProgress } | undefined;
  } catch (error) {
    throw toServiceError(error, "The issue did not load.");
  }
};

/** POST /admin/newsletter/campaigns */
export const createCampaign = async (payload: TCampaignInput) => {
  try {
    const res = await axiosInstance.post(
      "/admin/newsletter/campaigns",
      payload,
    );

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The draft was not saved.");
  }
};

/** PUT /admin/newsletter/campaigns/:id */
export const updateCampaign = async ({
  id,
  payload,
}: {
  id: string;
  payload: TCampaignInput;
}) => {
  try {
    const res = await axiosInstance.put(
      `/admin/newsletter/campaigns/${id}`,
      payload,
    );

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The draft was not saved.");
  }
};

/** DELETE /admin/newsletter/campaigns/:id */
export const deleteCampaign = async (id: string) => {
  try {
    const res = await axiosInstance.delete(`/admin/newsletter/campaigns/${id}`);

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The draft was not deleted.");
  }
};

/** GET /admin/newsletter/campaigns/:id/preview */
export const previewCampaign = async (id: string) => {
  try {
    const res = await axiosInstance.get(
      `/admin/newsletter/campaigns/${id}/preview`,
    );

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The preview did not render.");
  }
};

/** POST /admin/newsletter/campaigns/:id/test */
export const testCampaign = async (id: string) => {
  try {
    const res = await axiosInstance.post(
      `/admin/newsletter/campaigns/${id}/test`,
    );

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The test copy was not sent.");
  }
};

/** POST /admin/newsletter/campaigns/:id/start */
export const startCampaign = async (id: string, subscriberIds?: string[]) => {
  try {
    const body = subscriberIds?.length ? { subscriberIds } : undefined;
    const res = await axiosInstance.post(
      `/admin/newsletter/campaigns/${id}/start`,
      body,
    );

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The issue did not start sending.");
  }
};

/** POST /admin/newsletter/campaigns/:id/continue */
export const continueCampaign = async (id: string) => {
  try {
    const res = await axiosInstance.post(
      `/admin/newsletter/campaigns/${id}/continue`,
    );

    return res.data;
  } catch (error) {
    throw toServiceError(error, "The next batch did not go out.");
  }
};

/** GET /admin/newsletter/campaigns/:id/progress */
export const getCampaignProgress = async (id: string) => {
  try {
    const res = await axiosInstance.get(
      `/admin/newsletter/campaigns/${id}/progress`,
    );

    return readData(res.data, "The sending progress did not load.") as
      ICampaignProgress | undefined;
  } catch (error) {
    throw toServiceError(error, "The sending progress did not load.");
  }
};
