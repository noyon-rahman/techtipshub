"use client";

import { useDeleteBlogByAdminUsingId } from "@/hooks/blog.hook";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
  useDisclosure,
} from "@heroui/react";
import { useState, type FormEvent } from "react";
import { FiTrash2 } from "react-icons/fi";

interface IProps {
  id: string;
  title?: string;
  refetchBlogs: () => void;
}

/**
 * The admin's delete confirmation for an article.
 *
 * The reason is not a form field so much as a payload: the API puts it in the
 * activity log and in the email that tells the author why the piece is gone.
 * So it is a controlled value here rather than a react-hook-form submission.
 * HeroUI's Textarea renders a React Aria text field, which sets the value
 * through its own controlled input and never forwards a `ref`, so it cannot be
 * registered the way a plain `<textarea>` can.
 *
 * `THForm` mounts its own `useForm`, so the submit it would drive never sees
 * the value anyway: the modal's `onSubmit` closes over a hook living outside
 * the provider.
 *
 * HeroUI's Modal already focuses its first field on open, traps focus, closes
 * on Escape and restores focus to the trigger.
 */
const AdminDeleteBlogModal = ({ id, title, refetchBlogs }: IProps) => {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  // The service answers a failed request with `success: false` instead of
  // throwing, so `onSuccess` runs either way and has to check the body.
  const { mutate: deleteBlog, isPending } = useDeleteBlogByAdminUsingId();

  const open = () => {
    setReason("");
    setError("");
    onOpen();
  };

  const handleDelete = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;

    const trimmed = reason.trim();
    if (!trimmed) {
      setError("Give a reason. It is sent to the author.");
      return;
    }

    setError("");
    deleteBlog(
      { blogId: id, reason: trimmed },
      {
        onSuccess(data) {
          // A failure keeps the dialog open so its toast is still on screen
          // and the reason is not lost.
          if (!data?.success) return;
          onOpenChange();
          refetchBlogs();
        },
      },
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        disabled={isPending}
        aria-label={title ? `Delete ${title}` : "Delete article"}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-[6px] px-2 text-xs font-medium text-danger transition-colors hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60 sm:min-h-8"
      >
        <FiTrash2 aria-hidden className="size-3.5" />
        Delete
      </button>

      <Modal
        size="md"
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        hideCloseButton={isPending}
        // A press outside the panel is not an answer. The reason field is typed
        // in, so a stray click on the page behind must not throw it away. Escape
        // and Cancel still close it.
        isDismissable={false}
        radius="lg"
      >
        <ModalContent>
          {(onClose) => (
            <form onSubmit={handleDelete} noValidate>
              <ModalHeader className="flex flex-col gap-1 pt-5">
                <span className="tth-label-sm text-danger">
                  This cannot be undone
                </span>
                <span className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]">
                  Delete{" "}
                  {title ? (
                    <span className="break-words">“{title}”</span>
                  ) : (
                    "this article"
                  )}
                  ?
                </span>
              </ModalHeader>

              <ModalBody>
                <p className="text-sm leading-relaxed text-default-600">
                  The article moves to the trash, its comments and views go with
                  it, and the author gets an email with your reason.
                </p>
                <Textarea
                  id="delete-blog-reason"
                  label="Reason"
                  placeholder="Why is this article being removed?"
                  description="The author reads this. It is also recorded in the activity log."
                  variant="bordered"
                  radius="lg"
                  minRows={3}
                  value={reason}
                  onValueChange={(next) => {
                    setReason(next);
                    if (error) setError("");
                  }}
                  isInvalid={!!error}
                  errorMessage={error}
                  isDisabled={isPending}
                />
              </ModalBody>

              <ModalFooter className="gap-2">
                <Button
                  variant="light"
                  radius="lg"
                  onPress={onClose}
                  isDisabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  color="danger"
                  radius="lg"
                  isLoading={isPending}
                  isDisabled={isPending}
                >
                  Delete article
                </Button>
              </ModalFooter>
            </form>
          )}
        </ModalContent>
      </Modal>
    </>
  );
};

export default AdminDeleteBlogModal;
