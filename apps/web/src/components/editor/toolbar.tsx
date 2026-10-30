"use client";

import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuBold,
  LuCode,
  LuEllipsis,
  LuItalic,
  LuLink,
  LuMinus,
  LuPilcrow,
  LuPlus,
  LuRedo,
  LuStrikethrough,
  LuUnderline,
  LuUndo,
} from "react-icons/lu";
import { blockStyleItems, slashItems } from "./slash-items";
import { InsertTableButton, TableControls } from "./table-controls";

interface IProps {
  editor: Editor | null;
  /** Opens the command palette. */
  onOpenMenu: () => void;
  /** Toolbar status, e.g. the word count. Words count as a writer types. */
  children?: React.ReactNode;
}

const ToolbarButton = ({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className={`flex size-8 items-center justify-center rounded-md transition-colors ${
      active
        ? "bg-default-200 text-foreground"
        : "text-default-600 hover:bg-default-100 hover:text-foreground"
    } disabled:opacity-40`}
  >
    {children}
  </button>
);

/** Fixed width of the block menu, in pixels; used to keep it on screen. */
const BLOCK_MENU_WIDTH = 224;
/** Roughly how much room the full list needs below its trigger. */
const BLOCK_MENU_HEIGHT = 340;

type MenuPosition =
  { left: number; top: number } | { left: number; bottom: number };

/**
 * Applies the block menu action for the current block type.
 *
 * The menu is portalled to the document and positioned against the viewport:
 * the toolbar is a horizontal scroll container (`overflow-x: auto` on narrow
 * screens), which clips an absolutely positioned child and made this menu
 * invisible.
 */
const BlockStyleMenu = ({ editor }: { editor: Editor | null }) => {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setPosition(null);
  }, []);

  const toggle = () => {
    if (open) {
      close();
      return;
    }

    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const left = Math.max(
      8,
      Math.min(rect.left, window.innerWidth - BLOCK_MENU_WIDTH - 8),
    );
    setPosition(
      window.innerHeight - rect.bottom < BLOCK_MENU_HEIGHT
        ? { left, bottom: window.innerHeight - rect.top + 4 }
        : { left, top: rect.bottom + 4 },
    );
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    // A viewport-positioned menu cannot follow the page, so a scroll outside
    // it dismisses it rather than leaving it detached from its trigger.
    const onScroll = (event: Event) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      close();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open, close]);

  const active = blockStyleItems.find((item) => item.isActive?.(editor!));
  const ActiveIcon = active?.icon ?? LuPilcrow;

  return (
    <>
      <div ref={triggerRef} className="relative">
        <ToolbarButton
          label="Block style"
          onClick={(event) => {
            event.stopPropagation();
            toggle();
          }}
        >
          <ActiveIcon className="size-4" />
          <LuEllipsis className="size-3" />
        </ToolbarButton>
      </div>
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Block style"
            style={position}
            className="fixed z-[60] max-h-[70vh] w-56 overflow-y-auto rounded-lg border border-default-200 bg-content1 p-1 shadow-xl"
          >
            {blockStyleItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.isActive?.(editor!) ?? false;
              return (
                <button
                  key={item.title}
                  type="button"
                  role="menuitem"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    // No "/query" text to remove here: apply the block directly.
                    if (item.chain) item.chain(editor!.chain().focus()).run();
                    else item.run?.(editor!);
                    close();
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                    isActive
                      ? "bg-default-100 text-foreground"
                      : "text-default-600 hover:bg-default-100"
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {item.title}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
};

/**
 * Editor toolbar.
 *
 * Deliberately small: the "/" menu and markdown shortcuts carry the block
 * commands, so the toolbar only needs the inline formatting people reach for
 * constantly. It draws no rule of its own: the composer already rules the block
 * it sits in, and the boxed editor draws the card around it.
 */
const Toolbar = ({ editor, onOpenMenu, children }: IProps) => {
  if (!editor) return null;

  const chain = () => editor.chain().focus();

  return (
    <div className="tth-toolbar flex flex-wrap items-center gap-0.5 px-1 py-1.5 sm:px-2">
      <ToolbarButton label="Insert block" onClick={onOpenMenu}>
        <LuPlus className="size-4" />
      </ToolbarButton>

      <BlockStyleMenu editor={editor} />

      <span className="mx-1 hidden h-5 w-px bg-default-200 sm:block" />

      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => chain().toggleBold().run()}
      >
        <LuBold className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => chain().toggleItalic().run()}
      >
        <LuItalic className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => chain().toggleUnderline().run()}
      >
        <LuUnderline className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => chain().toggleStrike().run()}
      >
        <LuStrikethrough className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        active={editor.isActive("code")}
        onClick={() => chain().toggleCode().run()}
      >
        <LuCode className="size-4" />
      </ToolbarButton>

      <span className="mx-1 hidden h-5 w-px bg-default-200 sm:block" />

      <ToolbarButton
        label={editor.isActive("link") ? "Edit link" : "Add link"}
        active={editor.isActive("link")}
        onClick={() =>
          slashItems.find((item) => item.title === "Link")?.run?.(editor)
        }
      >
        <LuLink className="size-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Divider"
        onClick={() => chain().setHorizontalRule().run()}
      >
        <LuMinus className="size-4" />
      </ToolbarButton>
      <InsertTableButton editor={editor} />

      <span className="ml-auto hidden items-center gap-1 sm:flex">
        {children}
        <ToolbarButton
          label="Undo"
          disabled={!editor.can().undo()}
          onClick={() => chain().undo().run()}
        >
          <LuUndo className="size-4" />
        </ToolbarButton>
        <ToolbarButton
          label="Redo"
          disabled={!editor.can().redo()}
          onClick={() => chain().redo().run()}
        >
          <LuRedo className="size-4" />
        </ToolbarButton>
      </span>

      {editor.isActive("table") && (
        <div className="mt-1 w-full shrink-0 border-t border-default-200 pt-1">
          <TableControls editor={editor} />
        </div>
      )}
    </div>
  );
};

export default Toolbar;
