"use client";

import { publicProfilePath } from "@/lib/blog-routes";
import { checkUsernameAvailabilityAction } from "@/services/reader/actions";
import {
  normaliseUsername,
  usernameProblem,
} from "@techtipshub/shared";
import { Input } from "@heroui/react";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { FiCheck } from "react-icons/fi";

const SITE_LABEL = "techtipshub.com";
const labelClass = "mb-1 block tth-label-sm text-default-600";

type TCheckState = "idle" | "checking" | "free" | "taken" | "invalid";

export const SignupUsernameField = () => {
  const {
    setValue,
    watch,
    setError,
    clearErrors,
    formState: { errors },
  } = useFormContext();

  const rawValue = (watch("username") as string | undefined) ?? "";
  const [checkState, setCheckState] = useState<TCheckState>("idle");
  const [reason, setReason] = useState<string | null>(null);

  const typed = normaliseUsername(rawValue);
  const shapeProblem = rawValue ? usernameProblem(typed) : null;
  const shown = typed || "yourname";

  useEffect(() => {
    if (!rawValue) {
      setCheckState("idle");
      setReason(null);
      clearErrors("username");
      return;
    }

    if (shapeProblem) {
      setCheckState("invalid");
      setReason(shapeProblem);
      setError("username", { type: "manual", message: shapeProblem });
      return;
    }

    let cancelled = false;
    setCheckState("checking");
    setReason(null);

    const timer = window.setTimeout(async () => {
      const result = await checkUsernameAvailabilityAction(typed);

      if (cancelled) return;

      if (!result.success || !result.data) {
        setCheckState("idle");
        setReason(null);
        return;
      }

      if (result.data.available) {
        setCheckState("free");
        setReason("That username is free.");
        clearErrors("username");
      } else {
        setCheckState("taken");
        const refusal = result.data.reason ?? "That username cannot be used.";
        setReason(refusal);
        setError("username", { type: "manual", message: refusal });
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [rawValue, typed, shapeProblem, setError, clearErrors]);

  const errorMessage = errors.username?.message as string | undefined;

  return (
    <div>
      <label htmlFor="username" className={labelClass}>
        Username
      </label>
      <Input
        id="username"
        variant="bordered"
        radius="lg"
        placeholder="e.g. noyon"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck="false"
        maxLength={30}
        value={rawValue}
        onValueChange={(val) => {
          setValue("username", val, { shouldValidate: true, shouldDirty: true });
        }}
        isInvalid={Boolean(errorMessage) || checkState === "taken" || checkState === "invalid"}
        classNames={{ inputWrapper: "h-11" }}
        startContent={
          <span aria-hidden className="select-none text-default-500">
            @
          </span>
        }
        aria-describedby="signup-username-status signup-username-url"
      />

      <p
        id="signup-username-url"
        className="mt-1 break-all text-xs text-default-600"
      >
        <span className="tabular-nums">
          {SITE_LABEL}
          {publicProfilePath(shown).replaceAll("%40", "@")}
        </span>
      </p>

      <p
        id="signup-username-status"
        role="status"
        aria-live="polite"
        className="mt-1 min-h-5 text-xs"
      >
        {checkState === "checking" && (
          <span className="inline-flex items-center gap-1.5 text-default-600">
            <span
              aria-hidden
              className="size-3 animate-spin rounded-full border border-current border-t-transparent"
            />
            Checking whether that username is free…
          </span>
        )}
        {checkState === "free" && (
          <span className="inline-flex items-center gap-1 font-medium text-success">
            <FiCheck aria-hidden className="size-3.5" />
            That username is free.
          </span>
        )}
        {(checkState === "taken" || checkState === "invalid") && reason && (
          <span className="font-medium text-danger">{reason}</span>
        )}
      </p>
    </div>
  );
};
