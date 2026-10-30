"use client";

import { ICategory } from "@/types";
import { Autocomplete, AutocompleteItem, Button, Spinner } from "@heroui/react";
import { Key, ReactNode, useMemo, useState } from "react";

export interface ICategoryPickerProps {
  /** Input id, so the parent's `<label htmlFor>` points at the search box. */
  id: string;
  categories: ICategory[];
  /** The selected category id, or a pending request the draft is filed under. */
  value: string;
  onChange: (id: string) => void;
  /** true while the list is being fetched */
  isLoading?: boolean;
  /** The message to show when the list could not be loaded. */
  error?: string;
  /** Retry the list. Rendered as a button in the error state. */
  onRetry?: () => void;
  isInvalid?: boolean;
  errorMessage?: string;
  /**
   * Called with the trimmed query when the writer asks for a category that is
   * not in the list.
   */
  onRequest?: (name: string) => void;
  /**
   * Names already requested by this writer, offered in the picker so the draft
   * keeps working.
   */
  extras?: { id: string; name: string; pending: boolean }[];
  /**
   * A draft can hold a category that is neither live nor in `extras`: a
   * request made before a reload, or an id saved while the list was down. Its
   * name is passed so the field can still say what the draft is filed under
   * instead of showing nothing.
   */
  selectedName?: string;
  isDisabled?: boolean;
}

/** Case and accent insensitive, so "cafe" finds "Café". */
const fold = (text: string) => text.trim().normalize("NFD").toLowerCase();

/**
 * Matches anywhere in the name, because a writer who knows the word "script"
 * means JavaScript. Names that begin with the query come first, then the
 * alphabet decides.
 */
const rank = (query: string) => (a: string, b: string) => {
  const aStarts = a.startsWith(query);
  const bStarts = b.startsWith(query);

  if (aStarts !== bStarts) return aStarts ? -1 : 1;

  return a.localeCompare(b, "en", { sensitivity: "base" });
};

const REQUEST_PREFIX = "request:";

/**
 * The category field: a complete, searchable list rather than a dropdown that
 * hides two thirds of its options behind scroll.
 *
 * HeroUI's `Autocomplete` owns the combobox semantics (arrows, Enter, Escape,
 * ARIA). Filtering is ours: the search text lives here and the list is arranged
 * before it is handed over, so the built-in filter is replaced with `() => true`
 * and rendering walks the already-ranked array with an item render callback.
 *
 * Asking for a missing category is the last option inside that list, not a
 * separate control, so the arrow keys reach it. The form that follows belongs to
 * the parent.
 */
export const CategoryPicker = ({
  id,
  categories,
  value,
  onChange,
  isLoading = false,
  error,
  onRetry,
  isInvalid,
  errorMessage,
  onRequest,
  extras = [],
  selectedName: selectedNameFallback,
  isDisabled,
}: ICategoryPickerProps) => {
  const [query, setQuery] = useState("");
  // Whether the list is open. Kept here because the trigger reads its text from
  // the collection only while it is.
  const [isOpen, setIsOpen] = useState(false);
  const trimmed = query.trim();
  const needle = fold(trimmed);

  const matches = useMemo(() => {
    const order = rank(needle);

    return categories
      .filter((category) => fold(category.name).includes(needle))
      .sort((a, b) => order(fold(a.name), fold(b.name)));
  }, [categories, needle]);

  const shownExtras = extras.filter((extra) =>
    fold(extra.name).includes(needle),
  );

  // A draft can be filed under a name the list does not hold yet: the request
  // it is waiting on, or a category saved before the list could be read.
  const selectedMissing =
    Boolean(value) &&
    !categories.some((category) => category._id === value) &&
    !extras.some((extra) => extra.id === value);

  const selectedName =
    [
      ...categories.map((category) => ({
        id: category._id,
        name: category.name,
      })),
      ...extras.map((extra) => ({ id: extra.id, name: extra.name })),
    ].find((option) => option.id === value)?.name ?? selectedNameFallback;

  // Closing keeps whatever the search box should read afterwards; the caller
  // decides, because a selection and a dismissed search end differently. The
  // text is written after the blur, because HeroUI clears its input on the way
  // out and would take the chosen name with it.
  const close = (nextQuery = "") => {
    setIsOpen(false);
    document.getElementById(id)?.blur();
    queueMicrotask(() => setQuery(nextQuery));
  };

  // The parent files the request and stores the id it answers with, so this
  // only hands the name over.
  const request = () => {
    if (!onRequest) return;
    onRequest(trimmed);
    close();
  };

  const rows: {
    key: string;
    text: string;
    status?: boolean;
    node: ReactNode;
  }[] = [];

  // The status row answers "what am I looking at" for a screen reader, but it
  // is not something to choose: arrow keys move over options, not messages. It
  // only exists when it has something true to say, so a full list is options
  // and nothing else.
  const nothingShown = !matches.length && !shownExtras.length;
  const status = error
    ? { key: "status", text: "Unavailable" }
    : !categories.length && !extras.length
      ? { key: "status", text: "No categories" }
      : isLoading && nothingShown
        ? { key: "status-loading", text: "Loading categories" }
        : nothingShown
          ? { key: "status", text: "No match" }
          : null;

  if (status) {
    rows.push({
      ...status,
      status: true,
      node: (
        <span className="block text-sm leading-relaxed text-default-600">
          {status.key === "status-loading" ? (
            <span className="flex items-center gap-2">
              <Spinner size="sm" />
              Loading categories
            </span>
          ) : error ? (
            <>
              <span className="block">{error}</span>
              {onRetry && (
                <Button
                  size="sm"
                  variant="light"
                  onPress={onRetry}
                  className="mt-2 text-sm text-foreground"
                >
                  Try again
                </Button>
              )}
            </>
          ) : trimmed ? (
            `No category matches ${trimmed}.`
          ) : (
            "No categories yet."
          )}
        </span>
      ),
    });
  }

  // Picking the selected name reports it back, which keeps the draft and the
  // field agreeing even when the name came from outside the list.
  if (selectedMissing && selectedName) {
    rows.push({
      key: value,
      text: selectedName,
      node: (
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate">{selectedName}</span>
          <span className="shrink-0 text-xs text-default-600">
            Pending review
          </span>
        </span>
      ),
    });
  }

  matches.forEach((category) => {
    rows.push({
      key: category._id,
      text: category.name,
      node: (
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate">{category.name}</span>
          {typeof category.blogCount === "number" && category.blogCount > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-default-600">
              {category.blogCount}
            </span>
          )}
        </span>
      ),
    });
  });

  shownExtras.forEach((extra) => {
    rows.push({
      key: extra.id,
      text: extra.name,
      node: (
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate">{extra.name}</span>
          {extra.pending && (
            <span className="shrink-0 text-xs text-default-600">
              Pending review
            </span>
          )}
        </span>
      ),
    });
  });

  if (onRequest) {
    // A literal key, never equal to a category id, so Enter on a selected
    // name cannot be mistaken for the request action.
    rows.push({
      key: `${REQUEST_PREFIX}${needle}`,
      text: trimmed,
      node: (
        <span className="block truncate text-sm">
          {trimmed
            ? `Can't find it? Request ${trimmed}`
            : "Can't find it? Request a category"}
        </span>
      ),
    });
  }

  // HeroUI reads the trigger's text from the collection while the popover is
  // open, so it holds only what the writer is searching for. Once the popover
  // closes nothing fills that box, and a draft that arrives with a category
  // already chosen (a restore, a reload) would look empty. The name is shown
  // instead in exactly that case, leaving the next search to start from it.
  const shownValue = query || (!isOpen && selectedName) || "";

  return (
    <Autocomplete
      id={id}
      aria-label="Category"
      placeholder={isLoading ? "Loading categories" : "Choose a category"}
      variant="bordered"
      radius="sm"
      size="sm"
      menuTrigger="focus"
      items={rows}
      selectedKey={value || null}
      defaultFilter={() => true}
      // An empty collection would collapse the popover and take the loading,
      // error and request states inside it with it.
      allowsEmptyCollection
      onSelectionChange={(key: Key | null) => {
        if (key === null) return;

        const next = String(key);

        if (next.startsWith(REQUEST_PREFIX)) {
          request();

          return;
        }

        onChange(next);
        // The field keeps the chosen name in its search box once it closes.
        // HeroUI reads the display item from the open collection, so clearing
        // the text on blur would leave the trigger without the category the
        // writer just picked.
        close(rows.find((row) => row.key === next)?.text);
      }}
      onOpenChange={setIsOpen}
      inputValue={shownValue}
      onInputChange={setQuery}
      onClear={() => onChange("")}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      classNames={{
        popoverContent: "border border-default-100",
      }}
      listboxProps={{ emptyContent: "\u00a0" }}
    >
      {({ key, text, status, node }) => (
        <AutocompleteItem
          key={key}
          textValue={text}
          isDisabled={status}
          className={
            key.startsWith(REQUEST_PREFIX)
              ? "mt-1 border-t border-default-200 pt-2"
              : undefined
          }
        >
          {node}
        </AutocompleteItem>
      )}
    </Autocomplete>
  );
};

export default CategoryPicker;
