"use client";

import { focusRing } from "@/components/modules/admin/kit/tau";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { FiChevronDown } from "react-icons/fi";

const MENU_WIDTH = 208;
const GAP = 4;
const EDGE = 8;

interface IProps {
  /** Accessible name, e.g. "Actions for Ada Lovelace". */
  label: string;
  children: ReactNode;
}

interface IPosition {
  left: number;
  top: number;
  maxHeight: number;
}

/**
 * Compact hover target that keeps a menu open to the right. It is a button
 * with `aria-haspopup`, not a hover-only reveal, so touch and keyboard reach
 * the same items: Enter or Space opens, arrows move, Escape closes and returns
 * focus. Item rows from the caller use `role="menuitem"` and close on click.
 *
 * The panel is portalled to the body and placed with fixed coordinates. The
 * list frame clips its corners and the table scrolls inside it, so a panel
 * rendered beside the trigger was cut off at the frame's edge; a portal leaves
 * every ancestor's clipping and stacking to the viewport instead. Placement
 * flips above the trigger when the space below is short, and the panel stops
 * growing at the viewport edge so a long menu scrolls rather than runs off.
 */
export default function RowMenu({ label, children }: IProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<IPosition | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  const measure = useCallback(() => {
    const button = buttonRef.current;
    const panel = panelRef.current;
    if (!button || !panel) return;

    const rect = button.getBoundingClientRect();
    // A previous clamp would make the panel look shorter than it is and lose
    // the flip on the next open, so the height is read uncapped.
    panel.style.maxHeight = "none";
    const height = panel.offsetHeight;
    panel.style.removeProperty("max-height");
    const roomBelow = window.innerHeight - rect.bottom - GAP - EDGE;
    const roomAbove = rect.top - GAP - EDGE;

    const flipUp = height > roomBelow && roomAbove > roomBelow;
    const maxHeight = Math.max(0, flipUp ? roomAbove : roomBelow);
    const top = flipUp
      ? Math.max(EDGE, rect.top - GAP - Math.min(height, maxHeight))
      : rect.bottom + GAP;
    const left = Math.min(
      Math.max(EDGE, rect.right - MENU_WIDTH),
      Math.max(EDGE, window.innerWidth - MENU_WIDTH - EDGE),
    );

    setPosition({ left, top, maxHeight });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    panelRef.current
      ?.querySelector<HTMLElement>('[role="menuitem"]')
      ?.focus({ preventScroll: true });
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !panelRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus({ preventScroll: true });
      }
    };

    // The trigger moves with the page and with the table's own scroll, so the
    // fixed panel would be stranded. Closing is honest: reopening measures
    // again from wherever the trigger now sits.
    const onScroll = (event: Event) => {
      if (
        event.target instanceof Node &&
        panelRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onResize = () => setOpen(false);

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      panelRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"]:not([disabled]):not([aria-disabled="true"])',
      ) ?? [],
    );
    if (items.length === 0) return;

    const index = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(index + 1 + items.length) % items.length].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1].focus();
    } else if (event.key === "Tab") {
      setOpen(false);
    }
  };

  return (
    <div className="relative inline-flex justify-end">
      <button
        ref={buttonRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex size-11 items-center justify-center rounded-[6px] text-default-600 transition-colors hover:bg-default-100 hover:text-foreground aria-expanded:bg-default-100 aria-expanded:text-foreground sm:size-9 ${focusRing}`}
      >
        <FiChevronDown aria-hidden className="size-4" />
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            id={menuId}
            role="menu"
            aria-label={label}
            onKeyDown={onPanelKeyDown}
            onClick={() => setOpen(false)}
            onContextMenu={(event) => event.preventDefault()}
            style={{
              width: MENU_WIDTH,
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              maxHeight: position?.maxHeight,
              visibility: position ? "visible" : "hidden",
            }}
            className="fixed z-50 overflow-y-auto rounded-md border border-default/70 bg-content-1 py-1 shadow-[0_6px_20px_rgba(20,19,21,0.12)] dark:shadow-[0_6px_20px_rgba(0,0,0,0.5)]"
          >
            {children}
          </div>,
          document.body,
        )}
    </div>
  );
}
