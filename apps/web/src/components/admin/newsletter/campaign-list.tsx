"use client";

import { formatExact, formatRelative, isoDate } from "@/components/admin/utils";
import EmptyState from "@/components/modules/admin/kit/empty-state";
import AdminPagination from "@/components/modules/admin/kit/pagination";
import { focusRing } from "@/components/modules/admin/kit/tau";
import { useNewsletterCampaigns } from "@/hooks/admin-newsletter";
import type { ICampaignSummary, TCampaignStatus } from "@/services/admin/newsletter";
import { Skeleton } from "@heroui/react";
import { FiPlus } from "react-icons/fi";
import { RiNewspaperLine } from "react-icons/ri";

import { quietButton } from "./buttons";
import { CAMPAIGN_LABEL } from "./labels";

const tone: Record<TCampaignStatus, string> = {
  draft: "border-default-300 bg-default-50 text-default-700",
  sending: "border-primary/40 bg-primary/10 text-foreground",
  sent: "border-success/40 bg-success/10 text-foreground",
};

/** How far along the send is, as a sentence rather than a bare counter. */
const deliveryLine = (campaign: ICampaignSummary) => {
  if (campaign.status === "draft") return "Not sent yet";

  const reached = campaign.sentCount + campaign.failedCount;
  const of = campaign.recipientCount
    ? ` of ${campaign.recipientCount.toLocaleString()}`
    : "";

  const failed = campaign.failedCount
    ? `, ${campaign.failedCount.toLocaleString()} could not be delivered`
    : "";

  return `${reached.toLocaleString()}${of} delivered${failed}`;
};

interface IProps {
  page: number;
  onPageChange: (page: number) => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
}

/**
 * The issues sent so far, newest first, and the way into a new one.
 *
 * A row opens the issue: a draft opens for editing, a sending issue opens to
 * watch it, a sent issue opens as a record of what went out and to whom.
 */
const CampaignList = ({ page, onPageChange, onCreate, onOpen }: IProps) => {
  const query = useNewsletterCampaigns({ page });
  const meta = query.meta;
  const total = meta?.total ?? 0;
  const totalPages = Math.max(meta?.totalPages ?? 1, 1);

  if (query.isLoading) {
    return (
      <ul className="divide-y divide-default/60" aria-busy="true" aria-hidden>
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="space-y-2 px-3.5 py-3.5">
            <Skeleton className="h-4 w-56 rounded" />
            <Skeleton className="h-3 w-36 rounded" />
          </li>
        ))}
      </ul>
    );
  }

  if (query.isError) {
    return (
      <EmptyState
        variant="inline"
        icon={<RiNewspaperLine className="size-5" />}
        title="The issues could not be loaded"
        description={
          query.error?.message ||
          "The request to the API failed. Try again, and if it keeps failing check that the API is reachable."
        }
        action={
          <button
            type="button"
            onClick={() => query.refetch()}
            className={quietButton}
          >
            Try again
          </button>
        }
      />
    );
  }

  if (query.rows.length === 0) {
    return (
      <EmptyState
        variant="inline"
        icon={<RiNewspaperLine className="size-5" />}
        title="No issue has gone out yet"
        description="A new issue starts as a draft: pick the articles, write a subject and an intro, check a copy in your own inbox, then send it."
        action={
          <button type="button" onClick={onCreate} className={quietButton}>
            <FiPlus aria-hidden className="size-4" />
            Start the first issue
          </button>
        }
      />
    );
  }

  return (
    <>
      <ul
        aria-label={`Issues${total ? `, ${total} in total` : ""}, newest first`}
        aria-busy={query.isFetching || undefined}
        className="divide-y divide-default/60"
      >
        {query.rows.map((campaign) => (
          <li key={campaign._id}>
            <button
              type="button"
              onClick={() => onOpen(campaign._id)}
              className={`flex w-full flex-col gap-1.5 px-3.5 py-3 text-left transition-colors hover:bg-default-50 ${focusRing}`}
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {campaign.subject}
                </span>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.6875rem] font-medium ${tone[campaign.status]}`}
                >
                  {CAMPAIGN_LABEL[campaign.status]}
                </span>
              </span>

              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-default-600">
                <span className="truncate">{campaign.heading}</span>
                <span aria-hidden>·</span>
                <span className="tabular-nums">{deliveryLine(campaign)}</span>
                <span aria-hidden>·</span>
                <time
                  dateTime={
                    isoDate(campaign.startedAt ?? campaign.createdAt) ??
                    undefined
                  }
                  title={formatExact(campaign.startedAt ?? campaign.createdAt)}
                >
                  {campaign.startedAt
                    ? `Sent ${formatRelative(campaign.startedAt)}`
                    : `Drafted ${formatRelative(campaign.createdAt)}`}
                </time>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <AdminPagination
        page={meta?.page ?? page}
        totalPages={totalPages}
        total={total}
        pageSize={meta?.limit}
        onPageChange={onPageChange}
      />
    </>
  );
};

export default CampaignList;
