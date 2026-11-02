"use client";

import InterestPicker from "@/components/modules/reader/interest-picker";
import { safeRedirectPath, usernameOnboardingPath } from "@/lib/blog-routes";
import {
  readUsernameOnboardingAction,
  readWelcomeStateAction,
  saveInterestsAction,
} from "@/services/reader/actions";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * The welcome step: the one question a new member answers, once.
 *
 * Shown right after a first sign-in that never answered it; the profile's
 * Topics section has the same control, so this screen is a one-time question
 * rather than the only place the choice lives.
 *
 * The saved list and the greeting's name arrive from a server action after
 * load, because the page is prerendered and cannot ask who is reading. Until
 * it answers, the form is not shown: a save before then would send an empty
 * list and quietly wipe a choice the reader already made.
 *
 * Two ways out, both of which answer the API: "Save and continue" sends what is
 * ticked, and "Skip for now" sends an empty list. A skip is an answer too,
 * which is why the step does not come back.
 *
 * The action bar is pinned to the bottom edge: the topic list is taller than a
 * phone, and the way out should not be something you scroll to find.
 */
const WelcomeStep = ({ next }: { next: string }) => {
  const router = useRouter();

  const [firstName, setFirstName] = useState<string | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [saved, setSaved] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<"save" | "skip" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const destination = safeRedirectPath(next);

  useEffect(() => {
    let cancelled = false;

    // The handle step comes first, so a member who lands here by a direct link
    // before confirming one is sent back rather than asked about topics first.
    // Both answers arrive together so the page makes one round trip.
    Promise.all([
      readWelcomeStateAction(),
      readUsernameOnboardingAction(),
    ])
      .then(([{ interests: result, firstName: name }, username]) => {
        if (cancelled) return;

        setFirstName(name);

        if (username.success && username.data?.onboarded === false) {
          router.replace(
            `${usernameOnboardingPath}?next=${encodeURIComponent(destination)}`,
          );
          return;
        }

        if (result.success && result.data) {
          // An answer that is already on the account means the step was done
          // elsewhere, in another tab or before this page loaded: nothing to
          // ask.
          if (result.data.answered) {
            router.replace(destination);
            return;
          }

          setInterests(result.data.interests);
          setSaved(result.data.interests);
        }

        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, destination]);

  const submit = async (choice: "save" | "skip") => {
    setSaving(choice);
    setError(null);

    const result = await saveInterestsAction(choice === "skip" ? [] : interests);

    if (!result.success) {
      setSaving(null);
      setError(
        result.message ||
          "That did not save. Check your connection and try again.",
      );
      return;
    }

    // A client-side replace is right here: the feed it lands on is the same
    // prerendered document the reader already has, and its own after-load check
    // is what puts their order in place.
    router.replace(destination);
  };

  const changed =
    interests.length !== saved.length ||
    interests.some((id) => !saved.includes(id));

  return (
    <section className="mx-auto w-full max-w-read px-4 pb-32 pt-10 sm:px-6 sm:pt-14">
      <header>
        <p className="tth-label">Welcome</p>
        <h1 className="mt-2 font-[family-name:var(--type-editorial)] text-[2.5rem] font-semibold leading-[1.1] tracking-[-0.015em] sm:text-5xl">
          What do you want to read about{firstName ? `, ${firstName}` : ""}?
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-default-600">
          The feed starts with new writing on the topics you pick, and you can
          change this any time from your profile.
        </p>
      </header>

      <div className="mt-8">
        {loading ? (
          <div className="grid gap-2 sm:grid-cols-2" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-11 animate-pulse rounded-[6px] bg-default-100"
              />
            ))}
            <p className="sr-only" role="status">
              Loading the topics
            </p>
          </div>
        ) : (
          <InterestPicker
            selected={interests}
            onChange={setInterests}
            disabled={saving !== null}
          />
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-[10px] border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-foreground"
        >
          {error}
        </p>
      )}

      {/* The way out, always in reach. The bar shares the header's width and
          hairline so it reads as part of the site, not a separate panel. The
          count states what happens with the current pick, so neither button is
          a guess. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-default/60 bg-background">
        <div className="mx-auto flex w-full max-w-page flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-sm tabular-nums text-default-600">
            {interests.length === 0
              ? "Nothing picked. The feed shows everything."
              : `${interests.length} ${interests.length === 1 ? "topic" : "topics"} picked`}
          </p>

          <div className="flex gap-2">
            <Button
              variant="light"
              radius="lg"
              isLoading={saving === "skip"}
              isDisabled={saving !== null}
              onPress={() => submit("skip")}
              className="min-h-11 flex-1 sm:min-h-10 sm:flex-initial"
            >
              Skip for now
            </Button>
            <Button
              color="primary"
              radius="lg"
              isLoading={saving === "save"}
              isDisabled={saving !== null || (!changed && interests.length === 0)}
              onPress={() => submit("save")}
              className="min-h-11 flex-1 font-semibold sm:min-h-10 sm:flex-initial"
            >
              Save and continue
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default WelcomeStep;
