"use client";

import { formatExact, formatRelative, isoDate } from "@/components/admin/utils";
import { focusRing } from "@/components/modules/admin/kit/tau";
import {
  useCampaign,
  useCampaignProgress,
  useContinueCampaign,
  useDeleteCampaign,
  useStartCampaign,
} from "@/hooks/admin-newsletter";
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
  useDisclosure,
} from "@heroui/react";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

import CampaignEditor from "./campaign-editor";
import { dangerButton, primaryButton, quietButton } from "./buttons";
import { CAMPAIGN_LABEL } from "./labels";

interface IProps {
  id: string;
  onBack: () => void;
}

/** A filled bar, with the counter beside it as the source of truth. */
const Progress = ({
  sent,
  failed,
  total,
  remaining,
}: {
  sent: number;
  failed: number;
  total: number;
  remaining: number;
}) => {
  const done = sent + failed;
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

  return (
    <div className="space-y-2">
      <div
        role="progressbar"
        aria-label="Delivery progress"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} delivered`}
        className="h-2 w-full overflow-hidden rounded-full bg-default-200"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs tabular-nums text-default-600" aria-live="polite">
        {done.toLocaleString()} of {total.toLocaleString()} delivered
        {failed > 0 ? `, ${failed.toLocaleString()} failed` : ""}
        {remaining > 0 ? `, ${remaining.toLocaleString()} still to go` : ""}
      </p>
    </div>
  );
};

/**
 * One issue, read three ways.
 *
 * A draft is the builder, with sending behind a confirmation that states how
 * many people it reaches. A sending issue is the progress, with the button
 * that sends each further batch. A sent issue is a record: what went out,
 * when, and to how many.
 */
const CampaignDetail = ({ id, onBack }: IProps) => {
  const query = useCampaign(id);
  const progress = useCampaignProgress(id);
  const start = useStartCampaign();
  const drain = useContinueCampaign();
  const remove = useDeleteCampaign();
  const confirm = useDisclosure();

  if (query.isLoading) {
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-6 w-64 rounded" />
        <Skeleton className="h-4 w-40 rounded" />
        <Skeleton className="h-32 w-full rounded" />
      </div>
    );
  }

  const campaign = query.data?.campaign;

  if (query.isError || !campaign) {
    return (
      <div className="rounded-[10px] border border-default/60 px-4 py-8 text-center">
        <p className="text-sm font-semibold">This issue could not be opened</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-default-600">
          {query.error?.message || "It may have been deleted."}
        </p>
        <button type="button" onClick={onBack} className={`mt-4 ${quietButton}`}>
          Back to the list
        </button>
      </div>
    );
  }

  const status = progress.data?.status ?? campaign.status;
  const sent = progress.data?.sentCount ?? campaign.sentCount;
  const failed = progress.data?.failedCount ?? campaign.failedCount;
  const total = progress.data?.recipientCount ?? campaign.recipientCount;
  const remaining = progress.data?.remaining ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className={`mb-2 inline-flex min-h-9 items-center gap-1.5 rounded-[6px] px-1 text-xs font-medium text-default-600 hover:text-foreground ${focusRing}`}
          >
            <FiArrowLeft aria-hidden className="size-3.5" />
            All issues
          </button>
          <h2 className="truncate font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.015em]">
            {campaign.subject}
          </h2>
          <p className="mt-1 text-xs text-default-600">
            {CAMPAIGN_LABEL[status]}
            {" · "}
            {campaign.heading}
            {campaign.startedAt && (
              <>
                {" · "}
                <time
                  dateTime={isoDate(campaign.startedAt) ?? undefined}
                  title={formatExact(campaign.startedAt)}
                >
                  started {formatRelative(campaign.startedAt)}
                </time>
              </>
            )}
          </p>
        </div>
      </div>

      {status === "draft" && (
        <>
          <CampaignEditor
            draft={campaign}
            onSaved={() => query.refetch()}
            onRequestSend={confirm.onOpen}
          />

          <div className="flex flex-wrap items-center gap-2 border-t border-default/60 pt-4">
            <button
              type="button"
              onClick={() => remove.mutate(id, { onSuccess: onBack })}
              disabled={remove.isPending}
              className="ml-auto inline-flex min-h-11 items-center justify-center rounded-[6px] px-3 text-sm font-medium text-danger transition-colors hover:bg-danger/10 disabled:opacity-60 sm:min-h-9"
            >
              {remove.isPending ? "Deleting…" : "Delete this draft"}
            </button>
          </div>
        </>
      )}

      {status === "sending" && (
        <div className="space-y-4 rounded-[10px] border border-default/60 p-4">
          <Progress
            sent={sent}
            failed={failed}
            total={total}
            remaining={remaining}
          />
          <p className="text-xs leading-relaxed text-default-600">
            The rest goes out ten at a time, one press per batch.{" "}
            {remaining > 0
              ? `${remaining.toLocaleString()} ${remaining === 1 ? "address" : "addresses"} still to go.`
              : "This batch was the last one, so the issue is done."}{" "}
            The counters update here after each batch.
          </p>
          <button
            type="button"
            onClick={() => drain.mutate(id)}
            disabled={drain.isPending || remaining === 0}
            aria-busy={drain.isPending}
            className={primaryButton}
          >
            {drain.isPending
              ? "Sending a batch…"
              : remaining === 0
                ? "Everything is out"
                : `Send the next ${Math.min(remaining, 10)}`}
          </button>
        </div>
      )}

      {status === "sent" && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-[10px] border border-default/60 p-4">
            <Progress sent={sent} failed={failed} total={total} remaining={0} />
            <p className="text-xs text-default-600">
              {campaign.finishedAt && (
                <>
                  Finished{" "}
                  <time
                    dateTime={isoDate(campaign.finishedAt) ?? undefined}
                    title={formatExact(campaign.finishedAt)}
                  >
                    {formatRelative(campaign.finishedAt)}
                  </time>
                  .{" "}
                </>
              )}
              A sent issue is a record: its copy and article list are exactly
              what went out.
            </p>
          </div>

          {campaign.intro && (
            <p className="whitespace-pre-line text-sm leading-relaxed text-default-700">
              {campaign.intro}
            </p>
          )}

          <ol className="divide-y divide-default/60 rounded-[10px] border border-default/60">
            {campaign.articles.map((article, index) => (
              <li key={article.blog} className="px-3.5 py-2.5">
                <Link
                  href={article.href}
                  target="_blank"
                  className="flex items-baseline gap-2 text-sm text-foreground underline-offset-4 hover:underline"
                >
                  <span className="text-xs tabular-nums text-default-600">
                    {index + 1}.
                  </span>
                  <span className="min-w-0 truncate">{article.title}</span>
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}

      <Modal
        isOpen={confirm.isOpen}
        onOpenChange={(open) => {
          if (!open) confirm.onClose();
        }}
        radius="lg"
        size="sm"
        isDismissable={!start.isPending}
        hideCloseButton={start.isPending}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 pb-1 pt-5">
            <span className="text-xs font-semibold uppercase tracking-wide text-danger">
              This goes to real inboxes
            </span>
            <span className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]">
              Send “{campaign.subject}”?
            </span>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm leading-relaxed text-default-600">
              Everyone on the active list gets it: the people signed up right
              now, frozen at this moment. A signup after this press waits for
              the next issue, and an unsubscribe already on the list is not
              mailed.
            </p>
            <p className="text-sm leading-relaxed text-default-600">
              The first batch goes out right away and cannot be undone. The
              rest waits for you: press Continue once per batch of ten until
              the counters reach everyone. Send yourself a test copy first if
              you have not.
            </p>
          </ModalBody>
          <ModalFooter className="gap-2">
            <button
              type="button"
              onClick={confirm.onClose}
              disabled={start.isPending}
              className={quietButton}
            >
              Not yet
            </button>
            <button
              type="button"
              onClick={() =>
                start.mutate(campaign._id, {
                  onSuccess: () => {
                    confirm.onClose();
                    query.refetch();
                    progress.refetch();
                  },
                })
              }
              disabled={start.isPending}
              aria-busy={start.isPending}
              className={dangerButton}
            >
              {start.isPending ? "Starting…" : "Send to everyone"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default CampaignDetail;
