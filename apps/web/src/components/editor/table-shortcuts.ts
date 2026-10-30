import { Extension } from "@tiptap/core";
import { Plugin, TextSelection, type EditorState } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";

/**
 * Pipe tables, the markdown way.
 *
 * A header line, a `|---|` separator line and one or more body lines become a
 * real table as soon as Enter is pressed on the last body row - the same feel
 * as `# ` turning into a heading, one block bigger.
 *
 * StarterKit's input rules fire on the character being typed; this one has to
 * read the whole block, so it runs on Enter and walks the paragraphs above the
 * caret instead.
 */

/** A table being typed as plain paragraphs, ready to become a table. */
export interface PipeTableSource {
  /** Header cells, in order. */
  head: string[];
  /** Body rows, each with one cell per header column. */
  body: string[][];
  /** Absolute doc positions of the typed paragraphs, top to bottom. */
  ranges: Array<{ from: number; to: number }>;
}

/** `| a | b |`: the outer pipes are optional, as in most markdown. */
export const splitPipeRow = (line: string) => {
  if (!line.includes("|")) return null;
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
  return cells.length >= 2 ? cells : null;
};

/** A line that is only a table row (`| a | b |`) - used on paste. */
export const isPipeRow = (line: string) => splitPipeRow(line) !== null;

export { isPipeSeparator };

/** `|---|:---:|---:|`: every cell is a dash run, at least one column. */
const isPipeSeparator = (line: string) => {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
  return cells.length >= 2 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
};

/**
 * Reads the table typed above the caret.
 *
 * Returns `null` unless the caret sits at the end of the last body row, so the
 * rule never fires halfway through a table someone is still writing.
 */
export const readPipeTable = (state: EditorState): PipeTableSource | null => {
  const { $from } = state.selection;
  if (!$from.parent.isTextblock) return null;
  if (!$from.parent.content.size) return null;
  if ($from.parentOffset !== $from.parent.content.size) return null;

  const depth = $from.depth - 1;
  const blocks: Array<{ text: string; from: number; to: number }> = [];

  for (let index = $from.index(depth); index >= 0; index--) {
    const node = $from.node(depth).child(index);
    if (!node.isTextblock || !node.textContent.trim()) break;

    const from = $from.posAtIndex(index, depth);
    blocks.unshift({ text: node.textContent, from, to: from + node.nodeSize });
    // A table longer than this is not a table anyone typed by hand.
    if (blocks.length > 200) return null;
  }

  if (blocks.length < 3) return null;

  const head = splitPipeRow(blocks[0].text);
  if (!head || !isPipeSeparator(blocks[1].text)) return null;

  const body: string[][] = [];
  for (const block of blocks.slice(2)) {
    const cells = splitPipeRow(block.text);
    // Rows must line up with the header, or this is prose that happens to
    // contain pipes.
    if (!cells || cells.length !== head.length) return null;
    body.push(cells);
  }

  return {
    head,
    body,
    ranges: blocks.map(({ from, to }) => ({ from, to })),
  };
};

/** Builds the table node: one header row, then one row per body line. */
export const buildPipeTable = (state: EditorState, source: PipeTableSource) => {
  const { schema } = state;
  const paragraph = (text: string) =>
    schema.nodes.paragraph.create(null, text ? schema.text(text) : undefined);

  return schema.nodes.table.create(null, [
    schema.nodes.tableRow.create(
      null,
      source.head.map((text) =>
        schema.nodes.tableHeader.create(null, paragraph(text)),
      ),
    ),
    ...source.body.map((cells) =>
      schema.nodes.tableRow.create(
        null,
        cells.map((text) =>
          schema.nodes.tableCell.create(null, paragraph(text)),
        ),
      ),
    ),
  ]);
};

/**
 * Enter on the last row of a pipe table replaces the paragraphs with a table
 * and puts the caret in the first cell's text, ready to keep writing.
 */
const handleEnter = (view: EditorView, event: KeyboardEvent) => {
  if (event.key !== "Enter" || event.shiftKey || event.isComposing)
    return false;
  if (event.ctrlKey || event.metaKey || event.altKey) return false;

  const { state } = view;
  const source = readPipeTable(state);
  if (!source) return false;

  const start = source.ranges[0].from;
  const end = source.ranges[source.ranges.length - 1].to;

  event.preventDefault();
  const tr = state.tr.replaceWith(start, end, buildPipeTable(state, source));
  // table -> row -> cell -> paragraph, then one step into the first cell.
  const firstCellText = Math.min(start + 4, tr.doc.content.size);
  tr.setSelection(TextSelection.near(tr.doc.resolve(firstCellText)));

  view.dispatch(tr.scrollIntoView());
  return true;
};

export const TableShortcuts = Extension.create({
  name: "tableShortcuts",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleKeyDown: (view, event) => handleEnter(view, event),
        },
      }),
    ];
  },
});
