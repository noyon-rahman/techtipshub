import type { Editor } from "@tiptap/core";

/** The command dialogs an editor can open from its menus or toolbar. */
export type EditorDialogRequest = "link" | "image";

type Handler = (request: EditorDialogRequest) => void;

/**
 * Per-editor dialog handlers.
 *
 * The slash items are plain data with no React context, but they run against a
 * specific editor instance, so the mapping lives on that instance rather than
 * in module-level state that a second editor could overwrite.
 */
const handlers = new WeakMap<Editor, Handler>();

export const setEditorDialogHandler = (editor: Editor, handler: Handler) => {
  handlers.set(editor, handler);
  return () => {
    if (handlers.get(editor) === handler) handlers.delete(editor);
  };
};

export const requestEditorDialog = (
  editor: Editor,
  request: EditorDialogRequest,
) => {
  handlers.get(editor)?.(request);
};
