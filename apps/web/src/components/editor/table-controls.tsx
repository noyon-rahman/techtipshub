"use client";

import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  LuBetweenHorizontalEnd,
  LuBetweenHorizontalStart,
  LuBetweenVerticalEnd,
  LuBetweenVerticalStart,
  LuColumns3,
  LuEllipsis,
  LuMerge,
  LuRows3,
  LuSplit,
  LuTable,
  LuTableProperties,
  LuTrash,
} from "react-icons/lu";

/**
 * Table authoring.
 *
 * - `InsertTableButton` sits in the toolbar: three by three with a header row,
 *   or any size up to eight by eight from the grid.
 * - `TableControls` is a second toolbar row, shown only while the caret is in
 *   a table. Row and column commands only exist there, and putting them on the
 *   main toolbar would make it wrap to three lines on a phone.
 *
 * Cells are reachable with the keyboard: Tab and Shift+Tab move between them,
 * which the Table extension handles.
 */

type Size = { rows: number; cols: number };

const DEFAULT_SIZE: Size = { rows: 3, cols: 3 };

const ToolButton = ({
  label,
  disabled,
  buttonRef,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  buttonRef?: React.Ref<HTMLButtonElement>;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    ref={buttonRef}
    type="button"
    title={label}
    aria-label={label}
    disabled={disabled}
    onMouseDown={(event) => event.preventDefault()}
    onClick={onClick}
    className="flex size-8 shrink-0 items-center justify-center rounded-md text-default-600 transition-colors hover:bg-default-100 hover:text-foreground disabled:opacity-40"
  >
    {children}
  </button>
);

/** A row/column icon with a small bin, for the delete commands. */
const DeleteIcon = ({ Icon }: { Icon: typeof LuRows3 }) => (
  <span className="relative inline-flex">
    <Icon className="size-4" />
    <LuTrash className="absolute -bottom-1 -right-1 size-2.5 text-danger" />
  </span>
);

/** Grid picker, 1-8 rows by 1-8 columns. */
const SizePicker = ({
  anchor,
  onPick,
  onClose,
}: {
  /** The trigger's rect, so the portal can sit under it. */
  anchor: DOMRect;
  onPick: (size: Size) => void;
  onClose: () => void;
}) => {
  const [hover, setHover] = useState(DEFAULT_SIZE);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const width = 8 * 20 + 7 * 4 + 16;
  const left = Math.max(
    8,
    Math.min(anchor.left, window.innerWidth - width - 8),
  );
  const below = window.innerHeight - anchor.bottom >= 240;

  return createPortal(
    <div
      ref={ref}
      role="group"
      aria-label="Table size"
      style={
        below
          ? { left, top: anchor.bottom + 4 }
          : { left, bottom: window.innerHeight - anchor.top + 4 }
      }
      className="fixed z-[60] rounded-lg border border-default-200 bg-content1 p-2 shadow-xl"
    >
      <p className="mb-1.5 text-xs text-default-500" aria-live="polite">
        {hover.rows} × {hover.cols}
      </p>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: "repeat(8, 1.25rem)" }}
        onMouseLeave={() => setHover(DEFAULT_SIZE)}
      >
        {Array.from({ length: 64 }, (_, index) => {
          const rows = Math.floor(index / 8) + 1;
          const cols = (index % 8) + 1;
          const inHover = rows <= hover.rows && cols <= hover.cols;
          return (
            <button
              key={index}
              type="button"
              aria-label={`${rows} by ${cols} table`}
              onMouseEnter={() => setHover({ rows, cols })}
              onFocus={() => setHover({ rows, cols })}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick({ rows, cols })}
              className={`size-5 rounded-sm border transition-colors ${
                inHover
                  ? "border-primary bg-primary"
                  : "border-default-300 hover:border-primary"
              }`}
            />
          );
        })}
      </div>
    </div>,
    document.body,
  );
};

/**
 * Inserts a table.
 *
 * The size picker is portalled: the toolbar is a horizontal scroll container
 * (`overflow-x: auto`), which clips an absolutely positioned child.
 */
export const InsertTableButton = ({ editor }: { editor: Editor | null }) => {
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const chevronRef = useRef<HTMLButtonElement>(null);

  const insert = useCallback(
    (size: Size) => {
      setAnchor(null);
      if (!editor) return;
      editor
        .chain()
        .focus()
        .insertTable({ ...size, withHeaderRow: true })
        .run();
    },
    [editor],
  );

  const toggle = () => {
    if (anchor) {
      setAnchor(null);
      return;
    }
    const rect = chevronRef.current?.getBoundingClientRect();
    if (rect) setAnchor(rect);
  };

  if (!editor) return null;

  return (
    <>
      <div className="flex shrink-0 items-center">
        <ToolButton label="Insert table" onClick={() => insert(DEFAULT_SIZE)}>
          <LuTable className="size-4" />
        </ToolButton>
        <ToolButton
          buttonRef={chevronRef}
          label="Choose table size"
          onClick={toggle}
        >
          <span aria-hidden className="text-[10px]">
            ▾
          </span>
        </ToolButton>
      </div>
      {anchor && (
        <SizePicker
          anchor={anchor}
          onPick={insert}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
};

/** Escape leaves the table instead of being swallowed by the cell. */
const exitTable = (editor: Editor) => {
  const { $from } = editor.state.selection;
  let depth = $from.depth;
  while (depth > 0 && $from.node(depth).type.name !== "table") depth--;

  if (depth === 0) {
    editor.chain().focus().run();
    return;
  }

  const after = $from.after(depth);
  const { state } = editor;
  if (after >= state.doc.content.size) {
    const paragraph = state.schema.nodes.paragraph.create();
    editor
      .chain()
      .focus()
      .insertContentAt(state.doc.content.size, paragraph)
      .run();
    return;
  }
  editor
    .chain()
    .focus()
    .setTextSelection(after + 1)
    .run();
};

/** The second toolbar row shown while the caret is in a table. */
export const TableControls = ({ editor }: { editor: Editor }) => {
  const chain = () => editor.chain().focus();
  const menuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreAnchor, setMoreAnchor] = useState<DOMRect | null>(null);
  const [headerOn, setHeaderOn] = useState(
    editor.isActive({ headerRow: true }),
  );

  // A click inside the table moves the caret without changing the document,
  // so the header toggle re-reads the row it is in on every transaction.
  useEffect(() => {
    const update = () => setHeaderOn(editor.isActive({ headerRow: true }));
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const canMerge = editor.can().mergeCells();
  const canSplit = editor.can().splitCell();

  return (
    <div
      className="tth-toolbar-row flex items-center gap-0.5"
      role="toolbar"
      aria-label="Table controls"
    >
      <span className="mr-1 flex shrink-0 items-center gap-1 px-1 text-xs font-medium text-default-500">
        <LuTable className="size-4" aria-hidden />
        Table
      </span>

      <ToolButton
        label="Add row above"
        onClick={() => chain().addRowBefore().run()}
      >
        <LuBetweenHorizontalStart className="size-4" />
      </ToolButton>
      <ToolButton
        label="Add row below"
        onClick={() => chain().addRowAfter().run()}
      >
        <LuBetweenHorizontalEnd className="size-4" />
      </ToolButton>
      <ToolButton label="Delete row" onClick={() => chain().deleteRow().run()}>
        <DeleteIcon Icon={LuRows3} />
      </ToolButton>

      <span className="mx-1 h-5 w-px bg-default-200" />

      <ToolButton
        label="Add column left"
        onClick={() => chain().addColumnBefore().run()}
      >
        <LuBetweenVerticalStart className="size-4" />
      </ToolButton>
      <ToolButton
        label="Add column right"
        onClick={() => chain().addColumnAfter().run()}
      >
        <LuBetweenVerticalEnd className="size-4" />
      </ToolButton>
      <ToolButton
        label="Delete column"
        onClick={() => chain().deleteColumn().run()}
      >
        <DeleteIcon Icon={LuColumns3} />
      </ToolButton>

      <ToolButton
        label={headerOn ? "Remove header row" : "Add header row"}
        onClick={() => chain().toggleHeaderRow().run()}
      >
        <LuTableProperties className="size-4" />
      </ToolButton>

      {(canMerge || canSplit) && (
        <ToolButton
          label={canSplit ? "Split cell" : "Merge cells"}
          onClick={() =>
            (canSplit ? chain().splitCell() : chain().mergeCells()).run()
          }
        >
          {canSplit ? (
            <LuSplit className="size-4" />
          ) : (
            <LuMerge className="size-4" />
          )}
        </ToolButton>
      )}

      <div className="relative shrink-0">
        <ToolButton
          buttonRef={moreButtonRef}
          label="More table options"
          onClick={() => {
            if (moreOpen) {
              setMoreOpen(false);
              return;
            }
            const rect = moreButtonRef.current?.getBoundingClientRect();
            if (rect) setMoreAnchor(rect);
            setMoreOpen(true);
          }}
        >
          <LuEllipsis className="size-4" />
        </ToolButton>
        {moreOpen &&
          moreAnchor &&
          createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label="Table options"
              style={{
                left: Math.max(
                  8,
                  Math.min(moreAnchor.right - 208, window.innerWidth - 216),
                ),
                ...(window.innerHeight - moreAnchor.bottom < 200
                  ? { bottom: window.innerHeight - moreAnchor.top + 4 }
                  : { top: moreAnchor.bottom + 4 }),
              }}
              className="fixed z-[60] w-52 rounded-lg border border-default-200 bg-content1 p-1 shadow-xl"
            >
              {[
                {
                  label: headerOn ? "Remove header row" : "Add header row",
                  icon: LuTableProperties,
                  run: () => chain().toggleHeaderRow().run(),
                },
                {
                  label: "Merge cells",
                  icon: LuMerge,
                  disabled: !canMerge,
                  run: () => chain().mergeCells().run(),
                },
                {
                  label: "Split cell",
                  icon: LuSplit,
                  disabled: !canSplit,
                  run: () => chain().splitCell().run(),
                },
                {
                  label: "Delete table",
                  icon: LuTrash,
                  run: () => chain().deleteTable().run(),
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    item.run();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-default-600 hover:bg-default-100 disabled:opacity-40"
                >
                  <item.icon className="size-4 shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )}
      </div>

      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => exitTable(editor)}
        className="ml-auto shrink-0 rounded-md px-2 py-1 text-xs text-default-500 hover:bg-default-100 hover:text-foreground"
      >
        Done
      </button>
    </div>
  );
};

export type { Size };
