"use client";

import { publicProfilePath } from "@/lib/blog-routes";
import {
  changeUsernameAction,
  checkUsernameAvailabilityAction,
} from "@/services/reader/actions";
import { readUsernameState } from "@/services/user";
import {
  USERNAME_MAX_LENGTH,
  normaliseUsername,
  usernameProblem,
} from "@techtipshub/shared";
import { Button, Input } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FiCheck, FiLock } from "react-icons/fi";

/**
 * The handle, under the 30 day rule, saved on its own.
 *
 * It is not part of the profile form. The handle is the one field with a rule
 * of its own, a public address that moves when it changes, and a lock that
 * starts when it does, so it gets its own field, its own press and its own
 * answer. A refused handle then cannot take a name or a photo down with it,
 * and a saved profile cannot leave a half-changed address behind.
 *
 * Three states, each honest about the rule:
 *
 * - Locked: the handle is text with the date it unlocks, because the API
 *   refuses a change either way and an input that always fails is a worse
 *   answer than a field that says why.
 * - Unlocked: the handle can be typed. The API is asked as typing settles, and
 *   the answer is shown before the press, so "Change" is rarely a refusal.
 * - Confirming: a new handle is a public address that moves, so it is
 *   confirmed once in place rather than on the first press.
 *
 * `lockedUntil` comes from the API (`username/state`), never from a date this
 * screen computes: the lock is the server's rule, and a browser clock is not.
 */

type TCheck = "idle" | "checking" | "free" | "refused" | "unknown";

interface IProps {
  /** The handle the account holds now, as the server last reported it. */
  username?: string;
  disabled?: boolean;
}

const UsernameField = ({ username, disabled = false }: IProps) => {
  const router = useRouter();
  const current = normaliseUsername(username ?? "");

  const [lockedUntil, setLockedUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [typed, setTyped] = useState(current);
  const [touched, setTouched] = useState(false);
  const [check, setCheck] = useState<TCheck>("idle");
  const [reason, setReason] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // The form itself needs no lock date to render, and a failed read leaves
    // the field editable: the API refuses a locked change in its own words, so
    // the member still gets the unlock date, in the error, not a dead field.
    readUsernameState()
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setLockedUntil(result.data.lockedUntil);
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = normaliseUsername(typed);
  const shapeProblem = typed ? usernameProblem(value) : null;
  const changed = value !== current;

  // One request per settled keystroke, answered in the API's words. The shape
  // is checked here first so a half-typed handle costs no round trip and says
  // what is missing straight away.
  useEffect(() => {
    if (!touched || !typed) {
      setCheck("idle");
      setReason(null);
      return;
    }

    if (shapeProblem) {
      setCheck("refused");
      setReason(shapeProblem);
      return;
    }

    if (!changed) {
      setCheck("idle");
      setReason(null);
      return;
    }

    let cancelled = false;
    setCheck("checking");

    const timer = window.setTimeout(async () => {
      const result = await checkUsernameAvailabilityAction(value);
      if (cancelled) return;

      // A failed check is not an answer. Leaving the field without a verdict
      // keeps a network fault from looking like "taken", and the press still
      // gets the API's real answer.
      if (!result.success || !result.data) {
        setCheck("unknown");
        setReason(null);
        return;
      }

      setCheck(result.data.available ? "free" : "refused");
      setReason(result.data.available ? null : result.data.reason);
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [typed, value, touched, shapeProblem, changed]);

  const canChange =
    !loading &&
    changed &&
    !shapeProblem &&
    check !== "checking" &&
    check !== "refused";

  const reset = () => {
    setTyped(current);
    setTouched(false);
    setConfirming(false);
    setCheck("idle");
    setReason(null);
  };

  const change = async () => {
    if (saving || !changed || shapeProblem) return;

    setSaving(true);
    setReason(null);

    const result = await changeUsernameAction(value);

    if (!result.success) {
      // The API's own sentence, which for a locked change names the unlock
      // date. It is the same rule the field shows; it can be newer than this
      // render if something changed underneath.
      setSaving(false);
      setConfirming(false);
      setCheck("refused");
      setReason(result.message ?? "Your username was not changed.");
      return;
    }

    // The page behind carries the handle in its header and its share link.
    setSaved(value);
    setSaving(false);
    setConfirming(false);
    setTouched(false);
    setCheck("idle");
    router.refresh();
  };

  const unlockDate = lockedUntil ? formatUnlockDate(lockedUntil) : null;

  return (
    <div className="sm:col-span-2">
      <label
        htmlFor="username"
        className="mb-1 block tth-label-sm text-default-600"
      >
        Username
      </label>

      {unlockDate ? (
        <>
          <div className="flex min-h-11 items-center gap-2 rounded-[6px] border border-default/60 bg-default-50 px-3 text-sm">
            <FiLock aria-hidden className="size-4 shrink-0 text-default-500" />
            <span className="font-medium tabular-nums">@{current}</span>
          </div>
          <p className="mt-1 text-xs text-default-600">
            You can change this on {unlockDate}. It stays locked for 30 days
            after each change, so links people saved to your profile keep
            working.
          </p>
          <p className="mt-1 break-all text-xs text-default-600">
            {publicProfilePath(current)}
          </p>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <Input
                id="username"
                name="username"
                value={typed}
                onValueChange={(next) => {
                  setTouched(true);
                  setConfirming(false);
                  setSaved(null);
                  setTyped(next);
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  // Enter in this field changes the handle, never the profile
                  // form around it.
                  event.preventDefault();
                  if (confirming) void change();
                  else if (canChange) setConfirming(true);
                }}
                radius="lg"
                variant="bordered"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                maxLength={USERNAME_MAX_LENGTH}
                isDisabled={disabled || loading || saving}
                classNames={{ inputWrapper: "h-11 min-h-11" }}
                startContent={
                  <span aria-hidden className="select-none text-default-500">
                    @
                  </span>
                }
                aria-describedby="username-status"
              />
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {confirming ? (
                <>
                  <Button
                    radius="lg"
                    color="primary"
                    className="min-h-11 font-semibold sm:min-h-10"
                    isLoading={saving}
                    onPress={() => void change()}
                  >
                    Confirm change
                  </Button>
                  <Button
                    radius="lg"
                    variant="light"
                    className="min-h-11 sm:min-h-10"
                    isDisabled={saving}
                    onPress={reset}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  radius="lg"
                  variant="bordered"
                  className="min-h-11 font-semibold sm:min-h-10"
                  isDisabled={disabled || loading || !canChange}
                  onPress={() => setConfirming(true)}
                >
                  Change username
                </Button>
              )}
            </div>
          </div>

          <p
            id="username-status"
            role="status"
            aria-live="polite"
            className="mt-1 min-h-5 text-xs"
          >
            <Status
              check={check}
              reason={reason}
              changed={changed}
              saved={saved}
              confirming={confirming}
            />
          </p>

          <p className="mt-1 break-all text-xs text-default-600">
            {publicProfilePath(changed ? value : current)}
          </p>

          {confirming && (
            <p className="mt-1 text-xs text-default-600">
              Your profile moves to this address, and the current one keeps
              sending visitors to it. The next change is 30 days away.
            </p>
          )}
        </>
      )}
    </div>
  );
};

/**
 * The one line under the field: what the API said about the typed handle, or
 * what the account holds when nothing has been typed.
 */
const Status = ({
  check,
  reason,
  changed,
  saved,
  confirming,
}: {
  check: TCheck;
  reason: string | null;
  changed: boolean;
  saved: string | null;
  confirming: boolean;
}) => {
  if (saved) {
    return (
      <span className="inline-flex items-center gap-1 text-foreground">
        <FiCheck aria-hidden className="size-3.5" />
        Saved. You are now @{saved}.
      </span>
    );
  }

  if (!changed) {
    return (
      <span className="text-default-600">
        Your public profile address. You can change it once every 30 days.
      </span>
    );
  }

  if (check === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5 text-default-600">
        <span
          aria-hidden
          className="size-3 animate-spin rounded-full border border-current border-t-transparent"
        />
        Checking whether that address is free
      </span>
    );
  }

  if (check === "refused") {
    return (
      <span className="text-danger">
        {reason ?? "That username cannot be used."}
      </span>
    );
  }

  if (check === "unknown") {
    return (
      <span className="text-default-600">
        Could not check that address just now. Try Change username, which asks
        the server again.
      </span>
    );
  }

  return (
    <span className="text-foreground">
      {confirming
        ? "Press Confirm change to take this address."
        : "That address is free."}
    </span>
  );
};

/**
 * "12 Dec 2026", formatted on the server's answer with this device's locale so
 * it reads like every other date on the page.
 */
const formatUnlockDate = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default UsernameField;
