"use client";

import { primaryButton, quietButton } from "./buttons";
import { useAddSubscriber } from "@/hooks/admin-newsletter";
import {
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { useState } from "react";

interface IProps {
  isOpen: boolean;
  onClose: () => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Adding someone by hand, for a reader who asked to join by reply or in person.
 *
 * It is the same list the signup form writes to, so the same rules apply: an
 * address that already bounced or was reported is refused, and the API says
 * which of those happened. The greeting mail is a choice, because an address
 * typed in after a conversation does not always need a "welcome".
 */
const AddSubscriberModal = ({ isOpen, onClose }: IProps) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sendWelcome, setSendWelcome] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { mutate, isPending } = useAddSubscriber();

  const reset = () => {
    setName("");
    setEmail("");
    setSendWelcome(true);
    setError(null);
  };

  const close = () => {
    if (isPending) return;
    reset();
    onClose();
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("A first name is needed: every issue greets the reader by it.");
      return;
    }
    if (!EMAIL_PATTERN.test(trimmedEmail) || trimmedEmail.length > 254) {
      setError("That does not look like an email address.");
      return;
    }

    setError(null);
    mutate(
      { name: trimmedName, email: trimmedEmail, sendWelcome },
      { onSuccess: close },
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      radius="lg"
      size="md"
      isDismissable={!isPending}
      hideCloseButton={isPending}
    >
      <ModalContent>
        <form onSubmit={submit} noValidate>
          <ModalHeader className="flex flex-col gap-1 pb-1 pt-5">
            <span className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]">
              Add a subscriber
            </span>
            <span className="text-sm font-normal leading-relaxed text-default-600">
              They are written to the same list as the signup form, so they get
              the next issue and can unsubscribe from any one of them.
            </span>
          </ModalHeader>

          <ModalBody className="gap-4">
            <Input
              label="First name"
              labelPlacement="outside"
              placeholder="The name the email starts with"
              autoComplete="off"
              autoFocus
              isRequired
              isDisabled={isPending}
              value={name}
              onValueChange={setName}
              maxLength={60}
            />
            <Input
              label="Email"
              labelPlacement="outside"
              placeholder="reader@example.com"
              type="email"
              autoComplete="off"
              isRequired
              isDisabled={isPending}
              value={email}
              onValueChange={setEmail}
              maxLength={254}
            />
            <Checkbox
              size="sm"
              isSelected={sendWelcome}
              onValueChange={setSendWelcome}
              isDisabled={isPending}
            >
              <span className="text-sm">Send the welcome email now</span>
            </Checkbox>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </ModalBody>

          <ModalFooter>
            <button
              type="button"
              onClick={close}
              disabled={isPending}
              className={quietButton}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              aria-busy={isPending}
              className={primaryButton}
            >
              {isPending ? "Adding…" : "Add to the list"}
            </button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default AddSubscriberModal;
