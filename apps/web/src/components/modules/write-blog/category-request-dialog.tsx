"use client";

import { useRequestCategory } from "@/hooks/category.hook";
import type { IRequestedCategory } from "@/services/category/browser";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

/** Mirrors what the API accepts for a request: a trimmed name and a short note. */
const requestSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the category a name")
    .max(60, "Use 60 characters or fewer"),
  description: z.string().trim().max(200, "Use 200 characters or fewer"),
});

type TRequestForm = z.infer<typeof requestSchema>;

interface ICategoryRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** The name the writer was reaching for in the picker, if any. */
  suggestedName?: string;
  onRequested: (request: IRequestedCategory) => void;
}

/**
 * Asks an admin for a category the picker does not offer.
 *
 * It opens over the composer rather than replacing it, so the article stays on
 * screen while the request is written. The answer is a pending request: an
 * admin reviews it, and until then it can file the draft but not publish it.
 * Nothing is kept when it closes, because the form is the only state there is.
 */
const CategoryRequestDialog = ({
  isOpen,
  onClose,
  suggestedName,
  onRequested,
}: ICategoryRequestDialogProps) => {
  const { mutate: send, isPending } = useRequestCategory();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isValid },
  } = useForm<TRequestForm>({
    resolver: zodResolver(requestSchema),
    mode: "onTouched",
    defaultValues: { name: "", description: "" },
  });

  // Each opening starts from the name the writer typed, never from the last
  // attempt, so a closed and reopened dialog cannot resend a refused name by
  // accident.
  useEffect(() => {
    if (!isOpen) return;

    reset({ name: suggestedName?.trim() ?? "", description: "" });
    const frame = window.requestAnimationFrame(() => setFocus("name"));

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, suggestedName, reset, setFocus]);

  const onSubmit = handleSubmit((values) => {
    const name = values.name.trim();
    const description = values.description.trim();

    send(
      // The API rejects a blank description that is present, so it is left out.
      description ? { name, description } : { name },
      {
        onSuccess: (body) => {
          if (body?.success && body.data) {
            onRequested({ id: body.data._id, name: body.data.name });
            onClose();
            return;
          }

          // A 409 says either that the name is already a category or that this
          // member already asked for it. Both are about the name, and the name
          // field is where the member can act on it.
          setError("name", {
            type: "server",
            message: body?.message || "The request was not sent. Try again.",
          });
          setFocus("name");
        },
        onError: (error) => {
          setError("name", {
            type: "server",
            message: error?.message || "The request was not sent. Try again.",
          });
          setFocus("name");
        },
      },
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      // Escape and the close button both land here. A request in flight keeps
      // the dialog open, because its answer belongs in the form.
      onOpenChange={(open) => {
        if (!open && !isPending) onClose();
      }}
      isDismissable={!isPending}
      isKeyboardDismissDisabled={isPending}
      hideCloseButton={isPending}
      size="md"
      placement="center"
    >
      <ModalContent>
        <form onSubmit={onSubmit} noValidate>
          <ModalHeader className="flex flex-col gap-1">
            Request a category
          </ModalHeader>

          <ModalBody className="gap-5">
            <p className="text-sm leading-relaxed text-default-600">
              An admin reviews it before it appears in the category list. You
              can use it on this draft now.
            </p>

            <Input
              {...register("name")}
              label="Name"
              placeholder="e.g. Testing"
              variant="bordered"
              radius="sm"
              autoFocus
              maxLength={60}
              isInvalid={Boolean(errors.name)}
              errorMessage={errors.name?.message}
              isDisabled={isPending}
              classNames={{ inputWrapper: "min-h-10" }}
            />

            <Textarea
              {...register("description")}
              label="Description (optional)"
              description="Shown to the admin who reviews the request."
              placeholder="What would articles in this category be about?"
              variant="bordered"
              radius="sm"
              minRows={3}
              maxLength={200}
              isInvalid={Boolean(errors.description)}
              errorMessage={errors.description?.message}
              isDisabled={isPending}
            />
          </ModalBody>

          <ModalFooter className="gap-2">
            <Button
              type="button"
              variant="light"
              onPress={onClose}
              isDisabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              color="primary"
              isLoading={isPending}
              isDisabled={isPending || !isValid}
            >
              Send request
            </Button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};

export default CategoryRequestDialog;
