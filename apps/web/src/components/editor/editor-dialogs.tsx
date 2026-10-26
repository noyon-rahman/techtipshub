"use client";

import type { Editor } from "@tiptap/core";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { useEffect, useId, useState } from "react";
import {
  setEditorDialogHandler,
  type EditorDialogRequest,
} from "./editor-dialog-events";

interface SelectionSnapshot {
  from: number;
  to: number;
  selectedText: string;
  inLink: boolean;
}

/** Adds a scheme to a bare domain, and rejects schemes the editor will not use. */
const normalizeLink = (raw: string) => {
  const value = raw.trim();
  if (!value) return "";
  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return "";
  return `https://${value}`;
};

/** Accepts hosted, relative and inline images; rejects other schemes. */
const normalizeImage = (raw: string) => {
  const value = raw.trim();
  if (!value) return "";
  if (/^(data:image\/|https?:\/\/|\/)/i.test(value)) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return "";
  return `https://${value}`;
};

/**
 * In-page commands for the two things the editor cannot do in a menu: a link
 * needs a URL and optional text, an image needs a URL and alt text.
 *
 * Opened from the toolbar, the slash menu or the block menu. The selection is
 * captured when the dialog opens, because moving focus to the inputs would
 * otherwise be the only thing the editor remembers.
 */
export const EditorDialogs = ({ editor }: { editor: Editor | null }) => {
  const formId = useId();
  const [kind, setKind] = useState<EditorDialogRequest | null>(null);
  const [snapshot, setSnapshot] = useState<SelectionSnapshot | null>(null);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;

    return setEditorDialogHandler(editor, (request) => {
      const { selection, doc } = editor.state;
      const { from, to, empty } = selection;
      const inLink = editor.isActive("link");
      const previousHref = inLink
        ? (editor.getAttributes("link").href as string | undefined)
        : undefined;
      const selectedText = empty ? "" : doc.textBetween(from, to, " ");

      setSnapshot({ from, to, selectedText, inLink });
      setKind(request);
      setUrl(previousHref ?? "");
      setText(selectedText);
      setAlt("");
      setError(null);
    });
  }, [editor]);

  const close = () => {
    setKind(null);
    setSnapshot(null);
    setError(null);
  };

  const submit = () => {
    if (!editor || !kind || !snapshot) return;

    if (kind === "image") {
      const src = normalizeImage(url);
      if (!src) {
        setError("Enter an image URL that starts with https:// or /.");
        return;
      }

      editor
        .chain()
        .focus()
        .setTextSelection({ from: snapshot.from, to: snapshot.to })
        .setImage({ src, alt: alt.trim() || undefined })
        .run();
      close();
      return;
    }

    const href = normalizeLink(url);
    if (!href) {
      setError("Enter a link that starts with https://, mailto:, or /.");
      return;
    }

    const label = text.trim();
    const chain = editor
      .chain()
      .focus()
      .setTextSelection({ from: snapshot.from, to: snapshot.to });

    if (snapshot.from !== snapshot.to) {
      if (label && label !== snapshot.selectedText) {
        chain.deleteSelection().insertContent({
          type: "text",
          text: label,
          marks: [{ type: "link", attrs: { href } }],
        });
      } else {
        chain.extendMarkRange("link").setLink({ href });
      }
    } else if (snapshot.inLink) {
      chain.extendMarkRange("link").setLink({ href });
    } else {
      chain.insertContent({
        type: "text",
        text: label || href,
        marks: [{ type: "link", attrs: { href } }],
      });
    }

    chain.run();
    close();
  };

  const removeLink = () => {
    if (!editor || !snapshot) return;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: snapshot.from, to: snapshot.to })
      .extendMarkRange("link")
      .unsetLink()
      .run();
    close();
  };

  const isLink = kind === "link";
  const editingLink = isLink && Boolean(snapshot?.inLink);
  const showText =
    isLink && snapshot !== null
      ? snapshot.from !== snapshot.to || !snapshot.inLink
      : isLink;

  return (
    <Modal
      isOpen={kind !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      size="md"
      placement="center"
    >
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader className="text-base">
              {isLink
                ? editingLink
                  ? "Edit link"
                  : "Add link"
                : "Insert image"}
            </ModalHeader>
            <ModalBody>
              <form
                id={formId}
                className="flex flex-col gap-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  submit();
                }}
              >
                {showText && (
                  <Input
                    label="Text"
                    value={text}
                    onValueChange={setText}
                    variant="bordered"
                    radius="sm"
                    autoComplete="off"
                    description={
                      snapshot?.from !== snapshot?.to
                        ? "Change it to replace the selected text."
                        : "Shown in the article. Defaults to the URL."
                    }
                  />
                )}
                <Input
                  label={isLink ? "URL" : "Image URL"}
                  value={url}
                  onValueChange={(value) => {
                    setUrl(value);
                    setError(null);
                  }}
                  variant="bordered"
                  radius="sm"
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  placeholder={
                    isLink
                      ? "https://example.com"
                      : "https://example.com/image.png"
                  }
                />
                {!isLink && (
                  <Input
                    label="Alt text"
                    value={alt}
                    onValueChange={setAlt}
                    variant="bordered"
                    radius="sm"
                    description="Describe the image for readers who cannot see it. Leave empty only if it is decorative."
                  />
                )}
                {error && (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}
              </form>
            </ModalBody>
            <ModalFooter>
              {isLink && snapshot?.inLink && (
                <Button
                  variant="light"
                  color="danger"
                  className="mr-auto"
                  onPress={removeLink}
                >
                  Remove link
                </Button>
              )}
              <Button variant="light" onPress={onClose}>
                Cancel
              </Button>
              <Button color="primary" type="submit" form={formId}>
                {isLink
                  ? editingLink
                    ? "Update link"
                    : "Add link"
                  : "Insert image"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
};

export default EditorDialogs;
