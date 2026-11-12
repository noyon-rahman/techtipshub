"use client";

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
          className="group flex size-11 items-center justify-center rounded-[6px] text-default-600 transition-colors hover:bg-default-100/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:size-9"
        >
          <SearchIcon className="size-4.5" />
        </button>
      ) : (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={openPalette}
          className={`group flex w-full items-center gap-2.5 rounded-[6px] border border-default/60 bg-content-1/90 px-3 text-left text-sm text-default-600 transition-colors hover:border-default-300 hover:bg-content-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            block ? "h-10" : "h-9"
          }`}
        >
          <SearchIcon className="size-4 shrink-0 text-default-500 transition-colors group-hover:text-primary-accessible" />
          <span className="min-w-0 flex-1 truncate">
            Search articles, topics…
          </span>
          {!block && (
            <kbd
              className="hidden shrink-0 rounded-[4px] border border-default/60 bg-default-100/70 px-1.5 py-0.5 font-sans text-[11px] font-medium leading-none text-default-500 lg:inline"
              aria-hidden
            >
              ⌘K
            </kbd>
          )}
        </button>
      )}

      <CommandPalette open={open} onClose={close} />
    </>
  );
};

export default NavbarSearchInput;
