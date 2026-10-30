import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";
import {
  buildPipeTable,
  isPipeRow,
  isPipeSeparator,
  splitPipeRow,
  type PipeTableSource,
} from "./table-shortcuts";

/**
 * Pasting a table into the composer.
 *
 * Two things arrive as plain text and should come in as a table:
 *
 * - a spreadsheet selection, which is rows of tab-separated cells;
 * - a markdown pipe table, which is what people copy out of a chat window.
 *
 * Pasting `<table>` markup from a web page is handled by the Table extension
 * itself, since a copied table carries `text/html`.
 */

/** Cells pasted from a spreadsheet often have a trailing empty row. */
const trimEmptyRows = (rows: string[][]) =>
  rows.filter((row) => row.some((cell) => cell.length > 0));

const tsvSource = (text: string): PipeTableSource | null => {
  if (!text.includes("\t")) return null;

  const rows = trimEmptyRows(
    text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((row) => row.split("\t")),
  );
  if (rows.length < 2) return null;

  const width = Math.max(...rows.map((row) => row.length));
  // Ragged rows are what a spreadsheet gives when a cell holds a newline;
  // pad rather than reject, but only when it is close enough to be a grid.
  if (rows.some((row) => row.length < width / 2)) return null;

  const pad = (row: string[]) => [
    ...row,
    ...Array<string>(width - row.length).fill(""),
  ];

  const [head, ...body] = rows.map(pad);
  return { head, body, ranges: [] };
};

const pipeSource = (text: string): PipeTableSource | null => {
  const lines = text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;

  const head = splitPipeRow(lines[0]);
  const separator = lines[1];
  if (!head) return null;

  // With the `|---|` line it is a markdown table; without it, a grid of pipes.
  const bodyLines = isPipeSeparator(separator)
    ? lines.slice(2)
    : lines.slice(1);
  if (bodyLines.length === 0) return null;
  if (!bodyLines.every(isPipeRow)) return null;

  const body = bodyLines.map((line) => {
    const cells = splitPipeRow(line) ?? [];
    return [
      ...cells,
      ...Array<string>(head.length - cells.length).fill(""),
    ].slice(0, head.length);
  });

  return { head, body, ranges: [] };
};

export const PasteTable = Extension.create({
  name: "pasteTable",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const { state } = view;
            const data = event.clipboardData;
            if (!data) return false;
            // A copied table brings real HTML; let the editor parse it.
            if (data.getData("text/html")) return false;

            const text = data.getData("text/plain");
            if (!text) return false;

            // Pasting a grid into a table cell should stay a plain-text paste.
            const inside = state.selection.$from.node(
              state.selection.$from.depth - 1,
            );
            if (
              inside.type.name === "tableCell" ||
              inside.type.name === "tableHeader"
            ) {
              return false;
            }

            const source = tsvSource(text) ?? pipeSource(text);
            if (!source) return false;

            event.preventDefault();
            view.dispatch(
              state.tr.replaceSelectionWith(buildPipeTable(state, source)),
            );
            return true;
          },
        },
      }),
    ];
  },
});
