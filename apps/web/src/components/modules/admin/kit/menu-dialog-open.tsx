"use client";

import { createContext, useContext, useEffect } from "react";

/**
 * Tells a row menu when one of its dialogs is showing.
 *
 * The menu closes itself on any press it does not own, and the press on the
 * page behind a modal is one of those. Without this, that press unmounts the
 * dialog along with the panel, so the confirm button of a delete never got to
 * run. While a dialog is open the menu leaves Escape, presses and scrolls to
 * it instead of closing.
 *
 * The provider is the menu, so a menu hears only about its own dialogs: each
 * one wraps the items it owns.
 */
const MenuDialogOpenContext = createContext<((open: boolean) => void) | null>(
  null,
);

/**
 * Reports a dialog as open while it is, and closed once it is not.
 *
 * `open` is the dialog's own state, so a click on Cancel, a press on the
 * backdrop or the request completing all end the report the same way.
 */
export function useReportMenuDialog(open: boolean) {
  const report = useContext(MenuDialogOpenContext);

  useEffect(() => {
    if (!report) return;
    report(open);
    // Closing the menu unmounts this item and the dialog with it, so the menu
    // is told it is shut on the way out.
    return () => report(false);
  }, [open, report]);
}

export const MenuDialogOpenProvider = MenuDialogOpenContext.Provider;
