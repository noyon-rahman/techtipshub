"use client";

import { focusRing } from "@/components/modules/admin/kit/tau";
import { useNewsletterSubscribers } from "@/hooks/admin-newsletter";
import { Spinner } from "@heroui/react";
import { useState } from "react";
import { FiSearch } from "react-icons/fi";

export type RecipientMode = "all" | "selected";

interface IProps {
  mode: RecipientMode;
  onModeChange: (mode: RecipientMode) => void;
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  /** Whether to fetch the active subscriber list (e.g. when picker is visible). */
  enabled?: boolean;
}

/**
 * Shared recipient selector for newsletter campaigns: send to everyone on the
 * active list, or search and pick specific active subscribers.
 */
const RecipientPicker = ({
  mode,
  onModeChange,
  selectedIds,
  onSelectedIdsChange,
  enabled = true,
}: IProps) => {
  const [search, setSearch] = useState("");

  const subscribersQuery = useNewsletterSubscribers(
    {
      status: "active",
      limit: 50,
      page: 1,
      searchTerm: search.trim(),
    },
    enabled && mode === "selected",
  );

  const visible = subscribersQuery.rows;

  const toggleSubscriber = (subscriberId: string) => {
    onSelectedIdsChange(
      selectedIds.includes(subscriberId)
        ? selectedIds.filter((item) => item !== subscriberId)
        : [...selectedIds, subscriberId],
    );
  };

  const selectAllVisible = () => {
    const next = new Set(selectedIds);
    visible.forEach((sub) => next.add(sub._id));
    onSelectedIdsChange(Array.from(next));
  };

  return (
    <div className="space-y-3">
      <div
        role="radiogroup"
        aria-label="Recipients"
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        <button
          type="button"
          role="radio"
          aria-checked={mode === "all"}
          onClick={() => onModeChange("all")}
          className={`rounded-[8px] border px-3 py-2 text-left text-xs transition-colors ${focusRing} ${
            mode === "all"
              ? "border-primary bg-primary/10 font-semibold text-foreground"
              : "border-default/60 text-default-600 hover:bg-default-100"
          }`}
        >
          <span className="block">All active subscribers</span>
          <span className="mt-0.5 block font-normal text-default-500">
            Everyone on the active list
          </span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "selected"}
          onClick={() => onModeChange("selected")}
          className={`rounded-[8px] border px-3 py-2 text-left text-xs transition-colors ${focusRing} ${
            mode === "selected"
              ? "border-primary bg-primary/10 font-semibold text-foreground"
              : "border-default/60 text-default-600 hover:bg-default-100"
          }`}
        >
          <span className="block">Selected subscribers</span>
          <span className="mt-0.5 block font-normal text-default-500">
            {selectedIds.length > 0
              ? `${selectedIds.length} selected`
              : "Pick specific people"}
          </span>
        </button>
      </div>

      {mode === "selected" && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative min-w-0 flex-1">
              <FiSearch
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-default-500"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Filter active subscribers..."
                aria-label="Filter active subscribers"
                className={`h-8 w-full rounded-[6px] border border-default/60 bg-background pl-8 pr-3 text-xs text-foreground placeholder:text-default-500 ${focusRing}`}
              />
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={selectAllVisible}
                disabled={visible.length === 0}
                className="font-medium text-primary-accessible hover:underline disabled:opacity-50"
              >
                Select visible
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => onSelectedIdsChange([])}
                  className="text-default-600 hover:text-foreground"
                >
                  Clear ({selectedIds.length})
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 divide-y divide-default/60 overflow-y-auto rounded-[8px] border border-default/60">
            {subscribersQuery.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-xs text-default-600">
                <Spinner size="sm" />
                Loading active subscribers...
              </div>
            ) : visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-default-600">
                {search.trim()
                  ? `No active subscribers match "${search.trim()}".`
                  : "No active subscribers found."}
              </p>
            ) : (
              visible.map((sub) => {
                const checked = selectedIds.includes(sub._id);
                return (
                  <label
                    key={sub._id}
                    className={`flex cursor-pointer items-center gap-3 px-3 py-2 text-xs transition-colors hover:bg-default-100/60 ${
                      checked ? "bg-primary/5" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSubscriber(sub._id)}
                      className="size-4 rounded border-default-300 accent-primary"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {sub.name}
                      </span>
                      <span className="block truncate text-default-600">
                        {sub.email}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RecipientPicker;

