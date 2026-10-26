"use client";

import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuBold,
  LuCode,
  LuItalic,
  LuLink,
  LuStrikethrough,
  LuUnderline,
} from "react-icons/lu";
import { requestEditorDialog } from "./editor-dialog-events";

interface MenuPosition {
  left: number;
  top: number;
  below: boolean;
}

/** Distance between the selection and the bar. */
const GAP = 8;
/** Half the widest the bar gets on a phone, used to keep it on screen. */
const EDGE = 150;

const MenuButton = ({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className={`flex size-11 items-center justify-center rounded-md transition-colors sm:size-8 ${
      active
        ? "bg-default-200 text-foreground"
        : "text-default-600 hover:bg-default-100 hover:text-foreground"
    }`}
  >
    {children}
  </button>
);

/**
 * Inline formatting that follows a selection.
 *
 * The fixed toolbar at the top of the composer is still the keyboard and mobile
 * route; this bar exists so a writer formatting a sentence halfway down a long
 * article does not have to scroll back to the top. It is portalled and measured
 * from viewport coordinates, so the editor's own overflow cannot clip it.
 */
export const SelectionMenu = ({ editor }: { editor: Editor | null }) => {
  const [position, setPosition] = useState<MenuPosition | null>(null);
  // Marks change without the selection moving, so active states need a render
  // of their own even when the position stays the same.
  const [, setVersion] = useState(0);

  const update = useCallback(() => {
    if (!editor || !editor.isEditable) {
      setPosition(null);
      return;
    }

    const { selection } = editor.state;
    if (
      selection.empty ||
      !(selection instanceof TextSelection) ||
      editor.isActive("codeBlock") ||
      !editor.isFocused
    ) {
      setPosition(null);
      return;
    }

    const start = editor.view.coordsAtPos(selection.from);
    const end = editor.view.coordsAtPos(selection.to);
    if (!start || !end) {
      setPosition(null);
      return;
    }

    const left = Math.min(
      Math.max((start.left + end.right) / 2, EDGE),
      window.innerWidth - EDGE,
    );
    const topEdge = Math.min(start.top, end.top);
    const below = topEdge < 56;

    setPosition((current) => {
      const next: MenuPosition = {
        left,
        top: below ? Math.max(start.bottom, end.bottom) + GAP : topEdge - GAP,
        below,
      };
      return current &&
        current.left === next.left &&
        current.top === next.top &&
        current.below === next.below
        ? current
        : next;
    });
    setVersion((value) => value + 1);
  }, [editor]);

  useEffect(() => {
    if (!editor) return;

    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    editor.on("focus", update);
    editor.on("blur", update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      editor.off("focus", update);
      editor.off("blur", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [editor, update]);

  if (!editor || !position) return null;

  const chain = () => editor.chain().focus();

  return createPortal(
    <div
      role="toolbar"
      aria-label="Format selection"
      style={{
        left: position.left,
        top: position.top,
        transform: position.below
          ? "translate(-50%, 0)"
          : "translate(-50%, -100%)",
      }}
      className="fixed z-40 flex items-center gap-0.5 rounded-md border border-default-200 bg-content1 p-1 shadow-lg"
      onMouseDown={(event) => event.preventDefault()}
    >
      <MenuButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => chain().toggleBold().run()}
      >
        <LuBold className="size-4" />
      </MenuButton>
      <MenuButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => chain().toggleItalic().run()}
      >
        <LuItalic className="size-4" />
      </MenuButton>
      <MenuButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => chain().toggleUnderline().run()}
      >
        <LuUnderline className="size-4" />
      </MenuButton>
      <MenuButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => chain().toggleStrike().run()}
      >
        <LuStrikethrough className="size-4" />
      </MenuButton>
      <MenuButton
        label="Inline code"
        active={editor.isActive("code")}
        onClick={() => chain().toggleCode().run()}
      >
        <LuCode className="size-4" />
      </MenuButton>
      <span aria-hidden className="mx-0.5 h-5 w-px bg-default-200" />
      <MenuButton
        label={editor.isActive("link") ? "Edit link" : "Add link"}
        active={editor.isActive("link")}
        onClick={() => requestEditorDialog(editor, "link")}
      >
        <LuLink className="size-4" />
      </MenuButton>
    </div>,
    document.body,
  );
};

export default SelectionMenu;
