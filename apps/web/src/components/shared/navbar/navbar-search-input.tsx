"use client";

import { Kbd } from "@heroui/react";
import { useCallback, useState } from "react";
import { SearchIcon } from "@/components/icons";
import CommandPalette from "./command-palette";
import { usePaletteHotkeys } from "./command-palette/keys";

interface IProps {
  /** On the row the mobile menu gives it: full width, no keyboard hint. */
  block?: boolean;
  /**
   * A round icon on its own, for the header between `sm` and `lg` where the
   * full field has no room but the palette still has to be reachable.
   */
  compact?: boolean;
}

/**
 * The header's search field.
 *
 * It looks like the field it replaced and opens the palette instead of
 * navigating, because the palette is where the searching happens now. The
 * hotkey lives here too: ⌘K / Ctrl+K from anywhere on the page, and `/` when
 * no field has focus, so the field is reachable without hunting for it.
 */
const NavbarSearchInput = ({ block = false, compact = false }: IProps) => {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const openPalette = useCallback(() => setOpen(true), []);

  usePaletteHotkeys(openPalette);

  return (
    <>
      {compact ? (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label="Search articles and pages"
          onClick={openPalette}
          className="group flex size-10 items-center justify-center rounded-full text-default-600 transition-colors hover:bg-default-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70"
        >
          <SearchIcon className="size-5" />
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={openPalette}
          className="group flex w-full items-center gap-2.5 rounded-full border border-default-200 bg-default-50/70 py-2 pl-3.5 pr-2 text-left text-sm text-default-600 transition-colors hover:border-default-300 hover:bg-default-100/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 dark:bg-default-100/10 dark:hover:bg-default-100/20"
        >
          <SearchIcon className="size-4 shrink-0 text-default-500 transition-colors group-hover:text-default-600" />
          <span className="min-w-0 flex-1 truncate">
            Search articles, pages…
          </span>
          {!block && (
            <span
              className="hidden shrink-0 items-center gap-1 pr-0.5 lg:flex"
              aria-hidden
            >
              <Kbd keys={["command"]}>K</Kbd>
            </span>
          )}
        </button>
      )}

      <CommandPalette open={open} onClose={close} />
    </>
  );
};

export default NavbarSearchInput;
