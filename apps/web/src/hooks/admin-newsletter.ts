"use client";

/**
 * Newsletter hooks, admin side.
 *
 * Two lists and two jobs. The list of people (`useNewsletterSubscribers`) and
 * the list of issues (`useNewsletterCampaigns`) read like every other admin
 * table: paged on the server, previous rows kept while the next request runs.
 *
 * The jobs are the ones that take time: adding an address, an export, and the
 * send itself. Sending is the odd one: it happens in batches, each one a press
 * of its own, so `useCampaignProgress` polls while an issue is in flight and
 * stops the moment the API says it is done.
 */
import {
  addSubscriber,
  continueCampaign,
  createCampaign,
  deleteCampaign,
  deleteSubscriberPermanently,
  downloadSubscribersCsv,
  getCampaign,
  getCampaignProgress,
  getCampaignSuggestion,
  getCampaigns,
  getSubscribers,
  previewCampaign,
  readCampaignPage,
  readSubscriberPage,
  removeSubscriber,
  startCampaign,
  testCampaign,
  updateCampaign,
  type ICampaign,
  type ICampaignProgress,
  type ICampaignSummary,
  type INewsletterCounts,
  type INewsletterSubscriber,
  type INewsletterSubscribersParams,
} from "@/services/admin/newsletter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import {
  keepPreviousData,
  toAdminList,
  type IAdminList,
  type IAdminListResult,
} from "./admin-list";

export const ADMIN_NEWSLETTER_PAGE_SIZE = 20;

export const QUERY_KEYS = {
  subscribers: ["ADMIN_NEWSLETTER_SUBSCRIBERS"],
  campaigns: ["ADMIN_NEWSLETTER_CAMPAIGNS"],
  campaign: ["ADMIN_NEWSLETTER_CAMPAIGN"],
  progress: ["ADMIN_NEWSLETTER_PROGRESS"],
  suggestion: ["ADMIN_NEWSLETTER_SUGGESTION"],
} as const;

export const EMPTY_SUBSCRIBER_COUNTS: INewsletterCounts = {
  active: 0,
  unsubscribed: 0,
  bounced: 0,
  complained: 0,
  total: 0,
};

export type TSubscriberList = IAdminList<
  INewsletterSubscriber,
  IAdminListResult<INewsletterSubscriber>
>;

export type TSubscriberParams = INewsletterSubscribersParams;

export const useNewsletterSubscribers = (
  params: TSubscriberParams = {},
  enabled = true,
) => {
  const page = params.page ?? 1;
  const limit = params.limit ?? ADMIN_NEWSLETTER_PAGE_SIZE;
  const status = params.status ?? "all";
  const source = params.source ?? "all";
  const searchTerm = params.searchTerm ?? "";
  const sort = params.sort ?? "";

  const query = useQuery({
    queryKey: [
      ...QUERY_KEYS.subscribers,
      page,
      limit,
      status,
      source,
      searchTerm,
      sort,
    ],
    queryFn: async () => {
      const payload = await getSubscribers({
        page,
        limit,
        status,
        source,
        searchTerm: searchTerm || undefined,
        sort: sort || undefined,
      });
      const { rows, meta, counts } = readSubscriberPage(payload, {
        page,
        limit,
      });

      return { rows, meta, counts: { ...counts }, raw: payload };
    },
    enabled,
    placeholderData: keepPreviousData,
  });

  const list = toAdminList<
    INewsletterSubscriber,
    IAdminListResult<INewsletterSubscriber>
  >(query);

  return {
    ...list,
    counts:
      (query.data?.counts as INewsletterCounts | undefined) ??
      EMPTY_SUBSCRIBER_COUNTS,
  };
};

/**
 * Adds one address, then refreshes whatever list is on screen. The mutation
 * throws (the service does), so a toast never reports a success the API
 * refused.
 */
export const useAddSubscriber = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["ADMIN_NEWSLETTER_ADD"],
    mutationFn: addSubscriber,
    onSuccess: (data) => {
      const email = (data as { data?: { email?: string } })?.data?.email;
      toast.success(
        email ? `${email} is on the list.` : "The address is on the list.",
        { id: "admin-newsletter-add" },
      );
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscribers });
    },
    onError: (error: Error) => {
      toast.error(error?.message || "The subscriber was not added.", {
        id: "admin-newsletter-add",
      });
    },
  });
};

/** Removal is the reader's own unsubscribe, run from the panel. */
export const useRemoveSubscriber = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["ADMIN_NEWSLETTER_REMOVE"],
    mutationFn: removeSubscriber,
    onSuccess: () => {
      toast.success("Removed. They won't get another campaign.", {
        id: "admin-newsletter-remove",
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscribers });
    },
    onError: (error: Error) => {
      toast.error(error?.message || "The subscriber was not removed.", {
        id: "admin-newsletter-remove",
      });
    },
  });
};

export const useDeleteSubscriberPermanently = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["ADMIN_NEWSLETTER_DELETE_PERMANENT"],
    mutationFn: deleteSubscriberPermanently,
    onSuccess: () => {
      toast.success("Subscriber permanently deleted.", {
        id: "admin-newsletter-delete-permanent",
      });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.subscribers });
    },
    onError: (error: Error) => {
      toast.error(error?.message || "The subscriber could not be deleted.", {
        id: "admin-newsletter-delete-permanent",
      });
    },
  });
};

/**
 * The file arrives as a blob and is handed to a temporary link, so the browser
 * saves it the way it saves any download.
 */
export const useExportSubscribers = () => {
  return useMutation({
    mutationKey: ["ADMIN_NEWSLETTER_EXPORT"],
    mutationFn: async () => {
      const blob = await downloadSubscribersCsv();
      const url = URL.createObjectURL(blob);
      const day = new Date().toISOString().slice(0, 10);
      const link = document.createElement("a");

      link.href = url;
      link.download = `newsletter-subscribers-${day}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // The document has the link; the URL can go now.
      window.setTimeout(() => URL.revokeObjectURL(url), 0);

      return blob.size;
    },
    onSuccess: () => {
      toast.success("The list was downloaded.", {
        id: "admin-newsletter-export",
      });
    },
    onError: (error: Error) => {
      toast.error(error?.message || "The export did not download.", {
        id: "admin-newsletter-export",
      });
    },
  });
};

/* ------------------------------------------------------------ campaigns */

export const useNewsletterCampaigns = (
  params: { page?: number; limit?: number } = {},
) => {
  const page = params.page ?? 1;
  const limit = params.limit ?? ADMIN_NEWSLETTER_PAGE_SIZE;

  const query = useQuery({
    queryKey: [...QUERY_KEYS.campaigns, page, limit],
    queryFn: async () => {
      const payload = await getCampaigns({ page, limit });
      const { rows, meta } = readCampaignPage(payload, { page, limit });

      return { rows, meta, raw: payload };
    },
    placeholderData: keepPreviousData,
  });

  return toAdminList<ICampaignSummary, IAdminListResult<ICampaignSummary>>(
    query,
  );
};

/** What a new issue should start with: the heading, and articles not yet sent. */
export const useCampaignSuggestion = (enabled = true) => {
  return useQuery({
    queryKey: QUERY_KEYS.suggestion,
    queryFn: getCampaignSuggestion,
    enabled,
    staleTime: 60_000,
  });
};

export const useCampaign = (id?: string) => {
  return useQuery({
    queryKey: [...QUERY_KEYS.campaign, id],
    queryFn: async () => await getCampaign(id as string),
    enabled: Boolean(id),
  });
};

/**
 * The send in flight. Polling stops on its own when the API reports `sent` or
 * `draft`, so a finished issue costs nothing while the tab stays open. It
 * also catches a batch another admin pressed on the same issue.
 */
export const useCampaignProgress = (
  id?: string,
  options: { enabled?: boolean } = {},
) => {
  return useQuery<ICampaignProgress | undefined>({
    queryKey: [...QUERY_KEYS.progress, id],
    queryFn: async () => await getCampaignProgress(id as string),
    enabled: Boolean(id) && (options.enabled ?? true),
    refetchInterval: (query) =>
      query.state.data?.status === "sending" ? 5_000 : false,
  });
};

const invalidateCampaign = (
  queryClient: ReturnType<typeof useQueryClient>,
  id?: string,
) => {
  queryClient.invalidateQueries({ queryKey: QUERY_KEYS.campaigns });
  if (id) {
    queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.campaign, id] });
    queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.progress, id] });
  }
};

export const useCreateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["ADMIN_NEWSLETTER_CAMPAIGN_CREATE"],
    mutationFn: createCampaign,
    onSuccess: (data) => {
      const campaign = (data as { data?: ICampaign })?.data;
      invalidateCampaign(queryClient, campaign?._id);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.suggestion });
      toast.success("The draft is saved.", { id: "admin-newsletter-campaign" });
    },
    onError: (error) => {
      toast.error(error?.message || "The draft was not saved.", {
        id: "admin-newsletter-campaign",
      });
    },
  });
};

export const useUpdateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["ADMIN_NEWSLETTER_CAMPAIGN_UPDATE"],
    mutationFn: updateCampaign,
    onSuccess: (_data, variables) => {
      invalidateCampaign(queryClient, variables.id);
      toast.success("The draft is saved.", { id: "admin-newsletter-campaign" });
    },
    onError: (error: Error) => {
      toast.error(error?.message || "The draft was not saved.", {
        id: "admin-newsletter-campaign",
      });
    },
  });
};

export const useDeleteCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["ADMIN_NEWSLETTER_CAMPAIGN_DELETE"],
    mutationFn: deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.campaigns });
      toast.success("The draft is deleted.", {
        id: "admin-newsletter-campaign",
      });
    },
    onError: (error: Error) => {
      toast.error(error?.message || "The draft was not deleted.", {
        id: "admin-newsletter-campaign",
      });
    },
  });
};

export const usePreviewCampaign = () => {
  return useMutation({
    mutationKey: ["ADMIN_NEWSLETTER_CAMPAIGN_PREVIEW"],
    mutationFn: previewCampaign,
    onError: (error: Error) => {
      toast.error(error?.message || "The preview did not render.", {
        id: "admin-newsletter-preview",
      });
    },
  });
};

export const useTestCampaign = () => {
  return useMutation({
    mutationKey: ["ADMIN_NEWSLETTER_CAMPAIGN_TEST"],
    mutationFn: testCampaign,
    onSuccess: (data) => {
      const address = (data as { data?: { sentTo?: string } })?.data?.sentTo;
      toast.success(
        address
          ? `A test copy is on its way to ${address}.`
          : "Test copy sent.",
        { id: "admin-newsletter-test" },
      );
    },
    onError: (error: Error) => {
      toast.error(error?.message || "The test copy was not sent.", {
        id: "admin-newsletter-test",
      });
    },
  });
};

export type StartCampaignInput =
  | string
  | {
      id: string;
      subscriberIds?: string[];
    };

export const useStartCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["ADMIN_NEWSLETTER_CAMPAIGN_START"],
    mutationFn: (input: StartCampaignInput) => {
      if (typeof input === "string") return startCampaign(input);
      return startCampaign(input.id, input.subscriberIds);
    },
    onSuccess: (_data, input) => {
      const id = typeof input === "string" ? input : input.id;
      invalidateCampaign(queryClient, id);
      toast.success(
        "The first batch is out. Press Continue for each further batch.",
        { id: "admin-newsletter-send" },
      );
    },
    onError: (error: Error) => {
      toast.error(error?.message || "The issue did not start sending.", {
        id: "admin-newsletter-send",
      });
    },
  });
};

export const useContinueCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["ADMIN_NEWSLETTER_CAMPAIGN_CONTINUE"],
    mutationFn: continueCampaign,
    onSuccess: (_data, id) => {
      invalidateCampaign(queryClient, id);
    },
    onError: (error: Error) => {
      toast.error(error?.message || "The next batch did not go out.", {
        id: "admin-newsletter-send",
      });
    },
  });
};
