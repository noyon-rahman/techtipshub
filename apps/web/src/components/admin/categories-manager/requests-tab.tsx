"use client";

import { formatDate } from "@/components/admin/format";
import { quietButton } from "@/components/admin/list-controls";
import EmptyState from "@/components/modules/admin/kit/empty-state";
import FormDialog from "@/components/modules/admin/kit/form-dialog";
import ListFooter from "@/components/modules/admin/kit/list-footer";
import { focusRing } from "@/components/modules/admin/kit/tau";
import type { IAdminCategoryRequest } from "@/types";
import { Textarea } from "@heroui/react";
import { useState } from "react";
import { FiCheck, FiX } from "react-icons/fi";
import { RiInboxLine } from "react-icons/ri";

/** How many rows one page holds. Requests are short and rare, so one page. */
const PAGE_LIMIT = 10;

const approveButton = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[6px] bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-500 disabled:opacity-60 sm:min-h-9 ${focusRing}`;

const declineButton = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[6px] border border-default-200 px-3 text-sm font-medium text-foreground transition-colors hover:bg-default-100 disabled:opacity-50 sm:min-h-9 ${focusRing}`;

const nameOf = (request: IAdminCategoryRequest) =>
  request.name?.trim() || "Untitled";

/** Same date shape as the category rows, so two tabs do not read two ways. */
const formatDay = (value?: string) => formatDate(value) || "Not recorded";

interface IProps {
  rows: IAdminCategoryRequest[];
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry: () => void;
  page: number;
  onPageChange: (page: number) => void;
  /** The request whose decision is in flight, so its buttons say so. */
  busyId?: string;
  onApprove: (request: IAdminCategoryRequest) => void;
  onDecline: (
    request: IAdminCategoryRequest,
    reason: string | undefined,
  ) => void;
}

/**
 * The requests members sent from the composer, waiting for a decision.
 *
 * Rows rather than a table: the name is the decision, the description and the
 * sender are what it is judged on, and two actions sit at the end of each row.
 * Latest first, because the newest request is the one most likely to be read.
 *
 * A decision cannot be trusted to land: the API answers 409 when another admin
 * got there first, so the dialog stays open while the request runs and the
 * toast carries the server's own message.
 */
const RequestsTab = ({
  rows,
  isLoading,
  isFetching,
  isError,
  errorMessage,
  onRetry,
  page,
  onPageChange,
  busyId,
  onApprove,
  onDecline,
}: IProps) => {
  const [declining, setDeclining] = useState<IAdminCategoryRequest | null>(
    null,
  );
  const [approving, setApproving] = useState<IAdminCategoryRequest | null>(
    null,
  );
  const [reason, setReason] = useState("");

  const pageRows = rows.slice((page - 1) * PAGE_LIMIT, page * PAGE_LIMIT);
  const totalPages = Math.max(Math.ceil(rows.length / PAGE_LIMIT), 1);

  const closeDecline = () => {
    setDeclining(null);
    setReason("");
  };

  const closeApprove = () => setApproving(null);

  return (
    <>
      <div className="border-b border-default/60 px-3.5 py-2.5">
        <p className="tth-label">Requested categories</p>
        <p className="mt-0.5 text-xs leading-relaxed text-default-600">
          Members asked for these from the composer. Approving one makes it a
          live category they can publish under.
        </p>
      </div>

      {isLoading ? (
        <div className="divide-y divide-default/60">
          <p className="sr-only" role="status">
            Loading category requests
          </p>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="px-3.5 py-3.5" aria-hidden>
              <span className="block h-4 w-40 max-w-full rounded bg-default-100" />
              <span className="mt-2 block h-3 w-64 max-w-full rounded bg-default-100" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          variant="inline"
          icon={<RiInboxLine className="size-5" />}
          title="Requests could not be loaded"
          description={
            errorMessage ||
            "The request failed. Check that the API is running, then try again."
          }
          action={
            <button type="button" onClick={onRetry} className={quietButton}>
              Try again
            </button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<RiInboxLine className="size-5" />}
          title="No category requests are waiting"
          description="Members can ask for a category from the composer."
        />
      ) : (
        <ul
          className="divide-y divide-default/60"
          aria-label="Pending category requests"
          aria-busy={isFetching || undefined}
        >
          {pageRows.map((request) => {
            const busy = busyId === request._id;

            return (
              <li
                key={request._id}
                className="flex flex-col gap-3 px-3.5 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {nameOf(request)}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed text-default-600">
                    {request.description?.trim() || "No description"}
                  </p>
                  <p className="mt-1.5 text-xs text-default-600">
                    <span className="break-all">
                      {request.requestedByEmail || "Sender not recorded"}
                    </span>
                    <span aria-hidden> · </span>
                    <span className="tabular-nums">
                      {formatDay(request.createdAt)}
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setApproving(request)}
                    disabled={busy}
                    className={approveButton}
                  >
                    <FiCheck aria-hidden className="size-4" />
                    {busy ? "Approving" : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReason("");
                      setDeclining(request);
                    }}
                    disabled={busy}
                    className={declineButton}
                  >
                    <FiX aria-hidden className="size-4" />
                    Decline
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* A count under an error or a skeleton would state a total that is not
          known yet, or read as zero next to a failure. */}
      {!isError && !isLoading ? (
        <ListFooter
          total={rows.length}
          shown={pageRows.length}
          noun="request"
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_LIMIT}
          onPageChange={onPageChange}
          isLoading={false}
        />
      ) : null}

      <FormDialog
        isOpen={declining !== null}
        onClose={closeDecline}
        title={
          declining
            ? `Decline "${nameOf(declining)}"?`
            : "Decline this request?"
        }
        description="The request stays on record and nothing is published under it. The member is not told the reason, so keep this short."
        onSubmit={() => {
          if (!declining) return;
          const trimmed = reason.trim();
          onDecline(declining, trimmed || undefined);
          closeDecline();
        }}
        isPending={declining !== null && busyId === declining._id}
        submitLabel="Decline request"
        closeLabel="Cancel"
      >
        <Textarea
          label="Reason (optional)"
          labelPlacement="outside"
          placeholder="Already covered by another category"
          description="Visible to admins only. Leave it empty to decline without a note."
          minRows={2}
          maxRows={4}
          value={reason}
          onValueChange={setReason}
        />
      </FormDialog>

      {approving ? (
        <ApproveDialog
          request={approving}
          isPending={busyId === approving._id}
          onConfirm={() => {
            onApprove(approving);
            closeApprove();
          }}
          onClose={closeApprove}
        />
      ) : null}
    </>
  );
};

/** Approving creates a live category, so it asks first and says what happens. */
const ApproveDialog = ({
  request,
  isPending,
  onConfirm,
  onClose,
}: {
  request: IAdminCategoryRequest;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) => (
  <FormDialog
    isOpen
    onClose={onClose}
    title={`Approve "${nameOf(request)}"?`}
    description="It becomes a live category immediately and appears in the category picker and the feed. The member can publish with it straight away."
    onSubmit={onConfirm}
    isPending={isPending}
    submitLabel="Approve category"
    closeLabel="Cancel"
  >
    <p className="text-sm leading-relaxed text-default-600">
      {request.description?.trim() || "No description was given."}
    </p>
  </FormDialog>
);

export default RequestsTab;
