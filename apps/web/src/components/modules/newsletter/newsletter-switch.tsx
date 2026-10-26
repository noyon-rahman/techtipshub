"use client";

import {
  readMembershipAction,
  saveMembershipAction,
} from "@/services/newsletter/actions";
import { Switch } from "@heroui/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/**
 * The newsletter switch on the profile.
 *
 * Off by default for everyone, including a member who already joined from a
 * public form: the switch reads the list on mount, so it shows what is true
 * rather than what this page assumes.
 *
 * An address that bounced or was reported as spam cannot be switched back on,
 * because mailing it again is what damages the sending domain. The switch says
 * so instead of failing silently.
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
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">The monthly roundup</p>
        <p className="mt-1 text-sm leading-relaxed text-default-600">
          {suppressed
            ? "Mail to this address is being refused, so it cannot be added to the list. Write to us if you think that is wrong."
            : "One email a month with the articles worth your time. Every edition has an unsubscribe link."}
        </p>
      </div>

      <Switch
        aria-label="Receive the monthly newsletter"
        isSelected={subscribed}
        isDisabled={isLoading || isSaving || suppressed}
        onValueChange={save}
        size="sm"
        className="mt-0.5 shrink-0"
      />
    </div>
  );
};

export default NewsletterSwitch;
