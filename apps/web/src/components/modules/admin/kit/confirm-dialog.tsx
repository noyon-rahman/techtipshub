"use client";

import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@heroui/react";
import { useState } from "react";
import {
  cloneElement,
  isValidElement,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { focusRing } from "./tau";

interface ITriggerProps {
  onPress?: () => void;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
}

interface IProps {
  /**
   * The button that opens the dialog. It receives the open handler.
   * Omit it and pass `isOpen`/`onOpenChange` to drive the modal yourself,
   * when the dialog is opened from a row rather than a standing button.
   */
  trigger?: ReactNode;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "default" | "danger";
  isPending?: boolean;
  onConfirm: () => void;
}

/**
 * Confirmation step for destructive or irreversible admin actions. HeroUI's
 * modal already traps focus, closes on Escape and restores focus to the
 * trigger; what this adds is the trigger wiring, the danger treatment and the
 * pending state.
 *
 * The confirm action keeps its button busy while `isPending` is true so a
 * double press cannot fire twice, and the dialog stays open until the caller
 * clears it, which means an error message is never lost behind a closed modal.
 */
export default function ConfirmDialog({
  trigger,
  isOpen,
  onOpenChange,
  title,
  description,
  confirmLabel,
  tone = "default",
  isPending = false,
  onConfirm,
}: IProps) {
  const own = useDisclosure();
  const [hasPressed, setHasPressed] = useState(false);

  // Controlled when the caller passes `isOpen`; otherwise the trigger opens it.
  const controlled = typeof isOpen === "boolean";
  const open = controlled ? isOpen : own.isOpen;
  const setOpen = controlled ? onOpenChange : own.onOpenChange;
  const onClose = controlled ? () => setOpen?.(false) : own.onClose;
  const onOpen = controlled ? () => setOpen?.(true) : own.onOpen;

  const danger = tone === "danger";

  // HeroUI components expose `onPress`; a native `<button>` only listens for
  // `onClick`. Stop that click from bubbling, or a row menu unmounts the
  // dialog it just opened.
  const triggerNode = isValidElement(trigger)
    ? cloneElement(
        trigger as ReactElement<ITriggerProps> & { type?: unknown },
        typeof (trigger as { type?: unknown }).type === "string"
          ? {
              onClick: (event: MouseEvent<HTMLElement>) => {
                (trigger.props as ITriggerProps).onClick?.(event);
                event.stopPropagation();
                onOpen();
              },
            }
          : { onPress: onOpen },
      )
    : null;

  const close = () => {
    setHasPressed(false);
    onClose();
  };

  return (
    <>
      {triggerNode}

      <Modal
        isOpen={open}
        onOpenChange={(next) => {
          if (!next) setHasPressed(false);
          setOpen?.(next);
        }}
        radius="lg"
        size="sm"
        hideCloseButton={isPending}
        isDismissable={!isPending}
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 pb-1 pt-5">
            {danger && (
              <span className="tth-label-sm text-danger">
                This cannot be undone
              </span>
            )}
            <span className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]">
              {title}
            </span>
          </ModalHeader>
          <ModalBody>
            <p className="text-sm leading-relaxed text-default-600">
              {description}
            </p>
          </ModalBody>
          <ModalFooter className="gap-2">
            <button
              type="button"
              onClick={close}
              disabled={isPending}
              className={`inline-flex min-h-11 items-center justify-center rounded-[6px] border border-default-200 px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-default-100 disabled:opacity-50 sm:min-h-9 ${focusRing}`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setHasPressed(true);
                onConfirm();
              }}
              disabled={isPending}
              aria-busy={isPending}
              className={`inline-flex min-h-11 items-center justify-center rounded-[6px] px-3.5 text-sm font-semibold transition-colors disabled:opacity-60 sm:min-h-9 ${focusRing} ${
                danger
                  ? "bg-danger-600 text-white hover:bg-danger-700 dark:bg-danger dark:text-danger-foreground dark:hover:opacity-90"
                  : "bg-primary text-primary-foreground hover:bg-primary-500"
              }`}
            >
              {isPending && hasPressed ? "Working..." : confirmLabel}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}
