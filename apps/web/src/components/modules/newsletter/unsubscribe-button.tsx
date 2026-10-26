"use client";

import { leaveNewsletterAction } from "@/services/newsletter/actions";
import { useEffect, useRef, useState } from "react";
import { BiCheckCircle, BiErrorCircle } from "react-icons/bi";

type TState =
  | { kind: "leaving" }
  | { kind: "failed"; message: string }
  | { kind: "done"; message: string };

const FAILED =
  "We could not remove this address. Please try again shortly.";

interface IProps {
  /** The address the link was signed for, checked by the server. */
  email: string;
  token: string;
}

/**
 * The one control the unsubscribe page has.
 *
 * Removing the address is what opening the link asks for, so it happens on
 * arrival rather than on a second press: a reader who clicked unsubscribe in
 * an inbox should not have to confirm it on a page. Repeating is safe, which is
 * what makes a mailbox prefetching the URL harmless.
 *
 * A failure is the one case that needs a press, so the button waits for it.
 */
const UnsubscribeButton = ({ email, token }: IProps) => {
  const [state, setState] = useState<TState>({ kind: "leaving" });
  const [isSending, setIsSending] = useState(false);
  const messageRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let cancelled = false;

    leaveNewsletterAction({ email, token }).then((result) => {
      if (cancelled) return;

      setState(
        result.success
          ? {
              kind: "done",
              message: result.message || "You've been unsubscribed.",
            }
          : { kind: "failed", message: result.message || FAILED },
      );
    });

    return () => {
      cancelled = true;
    };
  }, [email, token]);

  // The outcome is the news on this page, so focus goes to it once it is known.
  useEffect(() => {
    if (state.kind === "leaving") return;
    messageRef.current?.focus();
  }, [state]);

  const retry = async () => {
    setIsSending(true);
    const result = await leaveNewsletterAction({ email, token });
    setIsSending(false);

    setState(
      result.success
        ? {
            kind: "done",
            message: result.message || "You've been unsubscribed.",
          }
        : { kind: "failed", message: result.message || FAILED },
    );
  };

  if (state.kind === "failed") {
    return (
      <div className="mt-6">
        <p
          ref={messageRef}
          tabIndex={-1}
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3.5 py-3 text-sm text-danger outline-none"
        >
          <BiErrorCircle aria-hidden className="mt-0.5 size-4 shrink-0" />
          {state.message}
        </p>
        <button
          type="button"
          onClick={retry}
          disabled={isSending}
          className="mt-4 inline-flex min-h-11 items-center rounded-[6px] border border-default-300 px-4 text-sm font-medium transition-colors hover:bg-default-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
        >
          {isSending ? "Trying…" : "Try again"}
        </button>
      </div>
    );
  }

  if (state.kind === "done") {
    return (
      <p
        ref={messageRef}
        tabIndex={-1}
        role="status"
        className="mt-6 flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 px-3.5 py-3 text-sm leading-relaxed text-foreground outline-none"
      >
        <BiCheckCircle
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-success"
        />
        {state.message}
      </p>
    );
  }

  return (
    <p
      role="status"
      aria-live="polite"
      className="mt-6 flex items-center gap-2 text-sm text-default-600"
    >
      <span
        aria-hidden
        className="size-3 animate-spin rounded-full border-2 border-default-300 border-t-foreground"
      />
      Removing this address…
    </p>
  );
};

export default UnsubscribeButton;
