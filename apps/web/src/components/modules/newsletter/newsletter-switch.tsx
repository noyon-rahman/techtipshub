"use client";

import {
  readMembershipAction,
  saveMembershipAction,
} from "@/services/newsletter/actions";
import { Switch } from "@heroui/react";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";

/**
 * The newsletter setting on the profile.
 *
 * One setting, so it is one row: what the email is on the left, the switch on
 * the right, and the state written beside the switch rather than left to a
 * browser tint. A switch is a binary the reader has to decode; "On" and "Off"
 * say the answer outright.
 *
 * `null` until the list answers, because a switch that starts off and turns
 * itself on is a switch that lied for a moment. The row reserves its height
 * while loading so the page does not jump under the reader's thumb.
 *
 * An address that bounced or was reported as spam cannot be switched back on,
 * because mailing it again is what damages the sending domain. The row says so
 * instead of failing silently.
 */
const NewsletterSwitch = () => {
  const [subscribed, setSubscribed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const suppressed = status === "bounced" || status === "complained";

  useEffect(() => {
    let cancelled = false;

    readMembershipAction().then((result) => {
      if (cancelled) return;

      setIsLoading(false);
      if (!result.success) return;

      setSubscribed(result.subscribed);
      setStatus(result.status);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const save = async (next: boolean) => {
    // The switch moves at once and goes back if the save fails, so it never
    // sits in the old position while the request travels.
    const previous = subscribed;
    setSubscribed(next);
    setIsSaving(true);

    const result = await saveMembershipAction(next);
    setIsSaving(false);

    if (!result.success) {
      setSubscribed(previous);
      toast.error(result.message || "Your newsletter setting was not saved.", {
        id: "newsletter-switch",
      });
      return;
    }

    setStatus(next ? "active" : "unsubscribed");
    toast.success(
      result.message ||
        (next ? "You're on the list." : "You won't get the newsletter again."),
      { id: "newsletter-switch" },
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
      <div className="min-w-0">
        <p className="tth-label">The monthly roundup</p>
        <p className="mt-1 text-sm leading-relaxed text-default-600">
          {suppressed
            ? "Mail to this address is being refused, so it cannot be added. Write to us if you think that is wrong."
            : "One email a month with the articles worth your time. Unsubscribe any time."}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <span
          role="status"
          aria-live="polite"
          className="w-16 text-right text-sm tabular-nums text-default-600"
        >
          {isLoading ? "…" : isSaving ? "Saving" : subscribed ? "On" : "Off"}
        </span>

        <Switch
          aria-label="Receive the monthly roundup email"
          isSelected={subscribed}
          isDisabled={isLoading || isSaving || suppressed}
          onValueChange={save}
          size="sm"
        />
      </div>
    </div>
  );
};

export default NewsletterSwitch;
