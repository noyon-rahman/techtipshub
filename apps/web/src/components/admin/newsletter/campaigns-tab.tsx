"use client";

import { useState } from "react";
import { FiPlus } from "react-icons/fi";

import CampaignDetail from "./campaign-detail";
import CampaignEditor from "./campaign-editor";
import CampaignList from "./campaign-list";
import { primaryButton } from "./buttons";
import type { RecipientMode } from "./recipient-picker";

type View =
  | { mode: "list" }
  | { mode: "new" }
  | {
      mode: "campaign";
      id: string;
      autoOpenSend?: boolean;
      initialRecipientMode?: RecipientMode;
      initialSelectedIds?: string[];
    };

/**
 * Issues, and the three screens they need: the list, the builder, and one
 * issue open.
 *
 * The view is local state rather than a route: a draft is short-lived work,
 * and leaving the tab should not leave a half-filled form reachable from the
 * browser's history. A reload starts clean, with the draft saved on the list.
 */
const CampaignsTab = () => {
  const [view, setView] = useState<View>({ mode: "list" });
  const [page, setPage] = useState(1);

  const toList = () => setView({ mode: "list" });

  if (view.mode === "new") {
    return (
      <div className="rounded-[10px] border border-default/60 bg-content-1 p-4 sm:p-5">
        <CampaignEditor
          onSaved={(id) => setView({ mode: "campaign", id })}
          onCancel={toList}
          onRequestSend={(id, selection) =>
            setView({
              mode: "campaign",
              id,
              autoOpenSend: true,
              initialRecipientMode: selection?.mode,
              initialSelectedIds: selection?.selectedIds,
            })
          }
        />
      </div>
    );
  }

  if (view.mode === "campaign") {
    return (
      <div className="rounded-[10px] border border-default/60 bg-content-1 p-4 sm:p-5">
        <CampaignDetail
          id={view.id}
          onBack={toList}
          autoOpenSend={view.autoOpenSend}
          initialRecipientMode={view.initialRecipientMode}
          initialSelectedIds={view.initialSelectedIds}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[60ch] text-sm leading-relaxed text-default-600">
          Create a campaign with a custom message, curated articles, or both,
          and send it to all or selected subscribers.
        </p>
        <button
          type="button"
          onClick={() => setView({ mode: "new" })}
          className={primaryButton}
        >
          <FiPlus aria-hidden className="size-4" />
          New campaign
        </button>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-default/60 bg-content-1">
        <CampaignList
          page={page}
          onPageChange={setPage}
          onCreate={() => setView({ mode: "new" })}
          onOpen={(id) => setView({ mode: "campaign", id })}
        />
      </div>

      <p className="text-xs leading-relaxed text-default-600">
        Sending runs in batches of ten, one press per batch, so a mail provider
        never sees a few thousand messages arrive in one burst.
      </p>
    </div>
  );
};

export default CampaignsTab;
