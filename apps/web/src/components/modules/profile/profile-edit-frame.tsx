"use client";

import { Button } from "@heroui/react";
import type { ReactNode } from "react";

interface IProps {
  isOpen: boolean;
  /** The first child at the bottom of the page; saving is an explicit act. */
  isPending: boolean;
  /** A photo is picked or cleared but the fields themselves are untouched. */
  filePending?: boolean;
  hint: string;
  onCancel: () => void;
  children: ReactNode;
}

/**
 * The editing frame around the profile page.
 *
 * Opening it moves the identity block into a form and adds the private fields
 * below it — the same section order the old settings page used, so the page
 * reads as one document being edited rather than a second screen.
 *
 * The save action is pinned to the bottom of the viewport while you are in the
 * form: the form is taller than a phone, and a "Save" that has scrolled out of
 * reach next to a live "Cancel" is the wrong pair.
 *
 * Cancel and Save both get lost on the narrowest screens if they are one row,
 * so they stack under the hint.
 */
const ProfileEditFrame = ({
  isOpen,
  isPending,
  filePending = false,
  hint,
  onCancel,
  children,
}: IProps) => {
  if (!isOpen) return null;

  const dirtyNote = filePending ? "Unsaved changes" : null;

  return (
    <div className="mt-8">
      <div className="mb-5 flex flex-col gap-2 rounded-xl border border-default/60 bg-default-50/60 px-4 py-3 text-sm text-default-700 dark:bg-default-100/5 sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="font-semibold text-foreground">Editing profile.</span>{" "}
          Nothing changes for readers until you save.
        </p>
        {dirtyNote && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-warning">
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {dirtyNote}
          </span>
        )}
      </div>

      {children}

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-default/60 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-xl lg:border lg:px-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-default-600">{hint}</p>
          <div className="flex items-center justify-end gap-2">
            <Button
              radius="lg"
              variant="light"
              type="button"
              isDisabled={isPending}
              onPress={onCancel}
            >
              Cancel
            </Button>
            <Button
              radius="lg"
              color="primary"
              type="submit"
              className="font-semibold"
              isLoading={isPending}
            >
              Save profile
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileEditFrame;
