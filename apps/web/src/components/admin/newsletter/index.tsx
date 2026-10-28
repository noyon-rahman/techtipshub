"use client";

import { focusRing } from "@/components/modules/admin/kit/tau";
import { useRef, useState, type KeyboardEvent } from "react";

import CampaignsTab from "./campaigns-tab";
import SubscribersTab from "./subscribers-tab";

const TABS = [
  { id: "issues", label: "Issues" },
  { id: "subscribers", label: "Subscribers" },
] as const;

type TabId = (typeof TABS)[number]["id"];

/**
 * The newsletter screen.
 *
 * Two subjects with a shared job: an issue goes to the list. They sit in one
 * place because the first question about any send is "who is on the list", and
 * the second is "what went out last month".
 */
const NewsletterManager = () => {
  const [tab, setTab] = useState<TabId>("issues");
  const tabRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((entry) => entry.id === tab);
    let next: number | undefined;

    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft")
      next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;

    if (next === undefined) return;
    event.preventDefault();
    setTab(TABS[next].id);
    tabRef.current
      ?.querySelectorAll<HTMLElement>('[role="tab"]')
      [next]?.focus();
  };

  return (
    <div className="space-y-5">
      <div
        ref={tabRef}
        role="tablist"
        aria-label="Newsletter"
        onKeyDown={onKeyDown}
        className="flex items-center gap-1 border-b border-default/60"
      >
        {TABS.map((entry) => {
          const selected = entry.id === tab;

          return (
            <button
              key={entry.id}
              type="button"
              role="tab"
              id={`newsletter-tab-${entry.id}`}
              aria-selected={selected}
              aria-controls={`newsletter-panel-${entry.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(entry.id)}
              className={`-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium transition-colors ${focusRing} ${
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-default-600 hover:text-foreground"
              }`}
            >
              {entry.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`newsletter-panel-${tab}`}
        aria-labelledby={`newsletter-tab-${tab}`}
      >
        {tab === "issues" ? <CampaignsTab /> : <SubscribersTab />}
      </div>
    </div>
  );
};

export default NewsletterManager;
