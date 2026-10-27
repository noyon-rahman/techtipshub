"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  type FormEvent,
  type ReactNode,
} from "react";
import { focusRing } from "./tau";

const primaryClass = `inline-flex min-h-11 items-center justify-center rounded-[6px] bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-500 disabled:opacity-60 sm:min-h-9 ${focusRing}`;

const quietClass = `inline-flex min-h-11 items-center justify-center rounded-[6px] border border-default-200 px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-default-100 disabled:opacity-50 sm:min-h-9 ${focusRing}`;

/**
 * A form that lives in a dialog, opened from a page-header button.
 *
 * The admin kit's `ConfirmDialog` is a question with two answers; this is a
 * form, so it carries its own fields and footer. It is a native `<dialog>`
 * opened with `showModal`, which gives the focus trap, the Escape key and the
 * inert page behind it for free, on top of `role="dialog"` and `aria-modal` in
 * every browser we ship to.
 *
 * Focus starts on the first field rather than the close button, because the
 * fields are what the dialog is for. Escape closes it, as it does the kit's
 * `ConfirmDialog`.
 *
 * The backdrop does not close it, unlike `ConfirmDialog`: that one asks a
 * question, this one holds a half-typed name, and a stray click outside is
 * easier to make than the deliberate Escape. Escape is also ignored while a
 * save is in flight, because the request cannot be recalled and an error
 * belongs in the open form.
 */
export default function FormDialog({
  isOpen,
  onClose,
  title,
  description,
  onSubmit,
  isPending = false,
  submitLabel,
  closeLabel = "Cancel",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onSubmit: () => void;
  isPending?: boolean;
  submitLabel: string;
  closeLabel?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  // Layout effect, so the dialog is modal before the first paint of its
  // contents and nothing outside it is briefly focusable.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const dialog = dialogRef.current;
    dialog?.querySelector<HTMLElement>("input, textarea, select")?.focus();
  }, [isOpen]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onClose={onClose}
      onCancel={(event) => {
        if (isPending) event.preventDefault();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-default/60 bg-content-1 p-0 text-foreground shadow-[0_18px_48px_rgba(20,19,21,0.18)] backdrop:bg-black/40"
    >
      <form onSubmit={submit} noValidate className="flex flex-col">
        <header className="flex flex-col gap-1 px-5 pt-5">
          <h2
            id={titleId}
            className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]"
          >
            {title}
          </h2>
          <p
            id={descriptionId}
            className="text-sm leading-relaxed text-default-600"
          >
            {description}
          </p>
        </header>

        <div className="flex flex-col gap-4 px-5 py-4">{children}</div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-default/60 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className={quietClass}
          >
            {closeLabel}
          </button>
          <button
            type="submit"
            disabled={isPending}
            aria-busy={isPending}
            className={primaryClass}
          >
            {isPending ? "Saving" : submitLabel}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
