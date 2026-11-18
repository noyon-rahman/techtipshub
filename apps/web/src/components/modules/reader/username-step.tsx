"use client";

import {
  afterUsernamePath,
  publicProfilePath,
  safeRedirectPath,
} from "@/lib/blog-routes";
import {
  checkUsernameAvailabilityAction,
  completeUsernameOnboardingAction,
  readUsernameOnboardingAction,
} from "@/services/reader/actions";
import {
  normaliseUsername,
  usernameProblem,
  type IUsernameAvailability,
} from "@techtipshub/shared";
import { Button, Input } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** How many pages the reader is told this address will be on. */
const SITE_LABEL = "techtipshub.com";

type TPending = "idle" | "checking" | "saving";

/**
 * The username step: the handle a new member will be addressed by.
 *
 * Shown once, straight after a first sign-in, with the suggestion already in
 * the field, so confirming it is one press. The member may instead type a
 * handle, and the field says as they type whether it can be claimed, in the
 * API's own words.
 *
 * The suggestion and whether the step still applies arrive from a server action
 * after load, because the page is prerendered and cannot ask who is reading.
 * Until then the field is a skeleton, not an empty input: a save before the
 * suggestion arrives would send a handle the member never saw.
 *
 * Inserting this step before the topics one means `next` is carried through to
 * `/welcome`, which asks the topic question and then goes on to the page the
 * member was originally sent to.
 */
const UsernameStep = ({ next }: { next: string }) => {
  const router = useRouter();

  const [name, setName] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<TPending>("idle");
  const [availability, setAvailability] =
    useState<IUsernameAvailability | null>(null);
  const [error, setError] = useState<string | null>(null);

  const destination = safeRedirectPath(next);

  // Before the server has answered, the URL preview shows the typed value. It
  // is the member's own handle, so there is nothing private in it.
  const typed = normaliseUsername(value);
  const shapeProblem = value ? usernameProblem(typed) : null;
  const shown = typed || "yourname";

  useEffect(() => {
    let cancelled = false;

    readUsernameOnboardingAction()
      .then((result) => {
        if (cancelled) return;

        if (!result.success || !result.data) {
          // Without the answer there is nothing to prefill, and saving an empty
          // field is worse than asking again on the next visit.
          setError(
            result.message ||
              "Your username did not load. Check your connection and try again.",
          );
          setLoading(false);
          return;
        }

        if (result.data.onboarded) {
          router.replace(afterUsernamePath(destination));
          return;
        }

        setName(result.data.suggestedUsername);
        setValue(result.data.suggestedUsername);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError("Your username did not load. Check your connection and try again.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router, destination]);

  // One request per settled keystroke: typing asks once after the pause
  // rather than on every raw change, and the answer that is shown is always
  // the one for the value in the field.
  useEffect(() => {
    if (!value) {
      setAvailability(null);
      setPending("idle");
      return;
    }

    if (shapeProblem) {
      setAvailability({
        username: typed,
        available: false,
        reason: shapeProblem,
      });
      setPending("idle");
      return;
    }

    let cancelled = false;
    setPending("checking");

    const timer = window.setTimeout(async () => {
      const result = await checkUsernameAvailabilityAction(typed);

      if (cancelled) return;

      setPending("idle");

      // A failed check is not an answer. Leaving the field without a verdict
      // keeps a network fault from looking like "taken".
      setAvailability(result.success && result.data ? result.data : null);
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [typed, value, shapeProblem]);

  const canSave =
    !loading &&
    pending !== "saving" &&
    pending !== "checking" &&
    Boolean(value) &&
    !shapeProblem &&
    availability?.available === true;

  const submit = async () => {
    if (!canSave) return;

    setPending("saving");
    setError(null);

    const result = await completeUsernameOnboardingAction(typed);

    if (!result.success) {
      setPending("idle");
      setError(
        result.message || "Your username was not saved. Try again in a moment.",
      );
      return;
    }

    // The topics step follows and carries the original destination with it. A
    // client-side replace keeps the sign-in landing on one document.
    router.replace(afterUsernamePath(destination));
  };

  const changed = touched && typed !== normaliseUsername(name ?? "");

  const status = (() => {
    if (!value) return null;
    if (shapeProblem) return { ok: false, text: shapeProblem };
    if (pending === "checking")
      return { ok: null, text: "Checking availability…" };
    if (!availability) return null;

    return {
      ok: availability.available,
      text: availability.available
        ? "That username is free."
        : (availability.reason ?? "That username cannot be used."),
    };
  })();

  return (
    <section className="mx-auto w-full max-w-read px-4 pb-32 pt-10 sm:px-6 sm:pt-14">
      <header>
        <p className="tth-label">Welcome</p>
        <h1 className="mt-2 font-[family-name:var(--type-editorial)] text-[2.5rem] font-semibold leading-[1.1] tracking-[-0.015em] sm:text-5xl">
          Pick your username
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-default-600">
          This is the address on your profile, your articles and your comments.
          It appears in links people share, so you can only change it once every
          30 days.
        </p>
      </header>

      <div className="mt-8 max-w-prose">
        {loading ? (
          <div className="space-y-3" aria-busy="true">
            <div className="h-11 animate-pulse rounded-[6px] bg-default-100" />
            <div className="h-5 w-2/3 animate-pulse rounded-[6px] bg-default-100" />
            <p className="sr-only" role="status">
              Loading your suggested username
            </p>
          </div>
        ) : (
          <>
            <label htmlFor="username" className="mb-1 block tth-label-sm text-default-600">
              Username
            </label>
            <Input
              id="username"
              value={value}
              onValueChange={(nextValue) => {
                setTouched(true);
                setValue(nextValue);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
              radius="lg"
              variant="bordered"
              autoComplete="username"
              spellCheck="false"
              autoCapitalize="none"
              maxLength={30}
              isDisabled={pending === "saving"}
              aria-describedby="username-status username-url"
              classNames={{ inputWrapper: "h-11" }}
              startContent={
                <span aria-hidden className="text-default-500 select-none">
                  @
                </span>
              }
            />

            {/* The live address, so the member sees the link before it exists
                rather than after it cannot be changed. */}
            <p id="username-url" className="mt-2 break-all text-sm text-default-600">
              <span className="tabular-nums">
                {SITE_LABEL}
                {publicProfilePath(shown).replaceAll("%40", "@")}
              </span>
            </p>

            <p
              id="username-status"
              role="status"
              aria-live="polite"
              className="mt-1 min-h-5 text-sm"
            >
              {status && (
                <span
                  className={
                    status.ok === false
                      ? "text-danger"
                      : status.ok === true
                        ? "text-success font-medium"
                        : "text-default-600"
                  }
                >
                  {status.text}
                </span>
              )}
            </p>

            {changed && (
              <button
                type="button"
                onClick={() => {
                  setValue(name ?? "");
                  setTouched(false);
                }}
                className="mt-1 text-sm font-medium text-primary-accessible underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300"
              >
                Use the suggestion instead
              </button>
            )}
          </>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 max-w-prose rounded-[10px] border border-danger/40 bg-danger/5 px-4 py-3 text-sm text-foreground"
        >
          {error}
        </p>
      )}

      {/* The one action, pinned like the topics step's bar. The field above is
          short, so this keeps the way forward where every other step puts it. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-default/60 bg-background">
        <div className="mx-auto flex w-full max-w-page flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <p className="text-sm text-default-600">
            You can change this once every 30 days.
          </p>

          <Button
            color="primary"
            radius="lg"
            isLoading={pending === "saving"}
            isDisabled={!canSave}
            onPress={() => void submit()}
            className="min-h-11 w-full font-semibold sm:min-h-10 sm:w-auto"
          >
            Save and continue
          </Button>
        </div>
      </div>
    </section>
  );
};

export default UsernameStep;
