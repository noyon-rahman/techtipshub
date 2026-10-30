import { schemaExtensions } from "./extensions";
import { PasteTable } from "./paste-table";
import { SlashCommand } from "./slash-command";
import { SlashKeys } from "./slash-keys";
import { TableShortcuts } from "./table-shortcuts";

/**
 * The full editor: the document schema plus the interactive extensions.
 *
 * Separate from `extensions.ts` because `slash-command.ts` is a React client
 * module. Keeping it out of the schema file lets the schema be imported by
 * plain Node scripts (the round-trip verification) with no browser or React.
 *
 * The table plugins are kept out of the schema file too: they change how
 * typing and pasting behaves, not what a table means in the saved HTML.
 */
export const editorExtensions = [
  ...schemaExtensions,
  TableShortcuts,
  PasteTable,
  SlashCommand,
  SlashKeys,
];
