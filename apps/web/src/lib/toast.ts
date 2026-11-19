/**
 * A guard around Sonner's `toast`.
 *
 * A successful API answer is `{ data }` with no `message` (see `api-contract`),
 * so a handler that forwards `data?.message` gives Sonner an empty title. It
 * still draws the icon and close button, which reads as a blank toast. Routing
 * every call through here means a missing message falls back to variant copy
 * instead of leaving an empty panel on screen.
 */
import { toast as sonnerToast, type ExternalToast } from "sonner";

type Variant = "success" | "error" | "info" | "warning" | "message";

const FALLBACK: Record<Variant, string> = {
  success: "Done.",
  error: "Something went wrong. Try again.",
  info: "Heads up.",
  warning: "Check that and try again.",
  message: "Done.",
};

const textOr = (message: unknown, fallback: string) =>
  typeof message === "string" && message.trim() ? message : fallback;

const guarded = (variant: Variant) => {
  const emit = sonnerToast[variant];

  return (message?: unknown, data?: ExternalToast) =>
    emit(textOr(message, FALLBACK[variant]), data);
};

export const toast = {
  ...sonnerToast,
  success: guarded("success"),
  error: guarded("error"),
  info: guarded("info"),
  warning: guarded("warning"),
  message: guarded("message"),
};
