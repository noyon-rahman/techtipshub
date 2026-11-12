"use client";

import { useCallback, useMemo, useState } from "react";

/**
 * Which rows of one admin list are picked for a bulk action.
 *
 * A selection is about "these rows", not "this page": it stays put when paging,
 * sorting or searching changes the list, and the bar keeps counting the hidden
 * ones. It is cleared when the list says `resetWith` changed, because the rows
 * behind those ids are no longer what the admin was looking at.
 *
 * `selectable` leaves rows out that a bulk action cannot touch (an admin account
 * cannot be deleted), so "select all" means "all the ones that can".
 */
export default function useRowSelection<T>({
  rows,
  getKey,
  selectable,
  resetWith,
  selectAllLabel,
}: {
  rows: T[];
  getKey: (row: T) => string;
  selectable?: (row: T) => boolean;
  resetWith?: unknown;
  /** Spoken by the header tick, e.g. "Select every article on this page". */
  selectAllLabel: string;
}) {
  const [keys, setKeys] = useState<string[]>([]);
  const [resetToken, setResetToken] = useState(resetWith);

  // A cleared list must not keep ids from the one before it. Adjusting during
  // render (React's own pattern for this) avoids a frame of the old selection.
  if (resetWith !== resetToken) {
    setResetToken(resetWith);
    setKeys([]);
  }

  const candidates = useMemo(
    () =>
      rows.filter((row) => selectable?.(row) ?? true).map((row) => getKey(row)),
    [rows, getKey, selectable],
  );

  const onPage = candidates.filter((key) => keys.includes(key));
  const allOnPage =
    candidates.length > 0 && onPage.length === candidates.length;

  const toggle = useCallback((key: string) => {
    setKeys((current) =>
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key],
    );
  }, []);

  const toggleAllOnPage = useCallback(() => {
    setKeys((current) => {
      if (candidates.every((key) => current.includes(key))) {
        return current.filter((key) => !candidates.includes(key));
      }
      return [
        ...current,
        ...candidates.filter((key) => !current.includes(key)),
      ];
    });
  }, [candidates]);

  const clear = useCallback(() => setKeys([]), []);

  return {
    keys,
    count: keys.length,
    selectAllLabel,
    /** How many picked rows are on the page on screen. */
    onPage: onPage.length,
    /** At least one picked row is still in the rows that were handed in. */
    hasRows: rows.some((row) => keys.includes(getKey(row))),
    allOnPage,
    someOnPage: onPage.length > 0 && !allOnPage,
    isSelected: (key: string) => keys.includes(key),
    toggle,
    toggleAllOnPage,
    clear,
  };
}

export type TRowSelection = ReturnType<typeof useRowSelection>;
