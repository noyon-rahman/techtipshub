"use client";

import { ICategory } from "@/types";
import { Autocomplete, AutocompleteItem, Button, Spinner } from "@heroui/react";
import { Key, ReactNode, useMemo, useState } from "react";

export interface ICategoryPickerProps {
  /** Input id, so the parent's `<label htmlFor>` points at the search box. */
  id: string;
  categories: ICategory[];
  /** The selected category id. */
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
   * Creates the category the writer named and hands back its id. Given for a
   * signed-in member, who may add a topic on the spot; a guest writes drafts
   * only, so they get no create row.
   */
  onCreate?: (name: string) => Promise<string | undefined>;
  /** A draft can hold a category the list no longer has. Its name is shown. */
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

const CREATE_PREFIX = "create:";

/**
 * The category field: a complete, searchable list rather than a dropdown that
 * hides two thirds of its options behind scroll.
 *
 * HeroUI's `Autocomplete` owns the combobox semantics (arrows, Enter, Escape,
 * ARIA). Filtering is ours: the search text lives here and the list is arranged
 * before it is handed over, so the built-in filter is replaced with `() => true`
 * and rendering walks the already-ranked array with an item render callback.
 *
 * A name the list does not hold ends in a create row, last, so the arrow keys
 * reach it after the matches. Choosing it creates the category and selects it
 * without leaving the field, which is the whole point: a writer with a new
 * topic should not lose their paragraph to a trip through a dialog.
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
  onCreate,
  selectedName: selectedNameFallback,
  isDisabled,
}: ICategoryPickerProps) => {
  const [query, setQuery] = useState("");
  // Whether the list is open. Kept here because the trigger reads its text from
  // the collection only while it is.
  const [isOpen, setIsOpen] = useState(false);
  // A create that failed says why under the field it was typed into, rather
  // than in the list, which closes as the answer arrives.
  const [createError, setCreateError] = useState<string | undefined>();
  const [creatingName, setCreatingName] = useState<string | null>(null);
  const trimmed = query.trim();
  const needle = fold(trimmed);

  const matches = useMemo(() => {
    const order = rank(needle);

    return categories
      .filter((category) => fold(category.name).includes(needle))
      .sort((a, b) => order(fold(a.name), fold(b.name)));
  }, [categories, needle]);

  // The name is already a category, only spelled with different capitals or
  // trailing spaces: there is nothing to create, only something to select.
  const alreadyExists = categories.some(
    (category) => fold(category.name) === needle,
  );

  // A draft can be filed under a category the list does not hold: removed
  // since, or saved while the list was down.
  const selectedMissing =
    Boolean(value) && !categories.some((category) => category._id === value);

  const selectedName =
    categories.find((category) => category._id === value)?.name ??
    selectedNameFallback;

  // Closing keeps whatever the search box should read afterwards; the caller
  // decides, because a selection and a dismissed search end differently. The
  // text is written after the blur, because HeroUI clears its input on the way
  // out and would take the chosen name with it.
  const close = (nextQuery = "") => {
    setIsOpen(false);
    document.getElementById(id)?.blur();
    queueMicrotask(() => setQuery(nextQuery));
  };

  const create = async (name: string) => {
    if (!onCreate) return;

    setCreateError(undefined);
    setCreatingName(name);

    try {
      const created = await onCreate(name);

      if (!created) {
        setCreateError("The category could not be created. Try again.");
        return;
      }

      onChange(created);
      close(name);
    } catch (failure) {
      setCreateError(
        failure instanceof Error && failure.message
          ? failure.message
          : "The category could not be created. Try again.",
      );
    } finally {
      setCreatingName(null);
    }
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
  const nothingShown = !matches.length;
  const status = error
    ? { key: "status", text: "Unavailable" }
    : !categories.length && !onCreate
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
      node: <span className="block truncate">{selectedName}</span>,
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

  // Offered only for a name that would become a new category, and only to a
  // writer who may make one. With no query the row still shows, saying what it
  // waits for, so the option is discoverable before anything is typed.
  const canCreate =
    Boolean(onCreate) &&
    !alreadyExists &&
    !matches.some((category) => fold(category.name) === needle);

  if (canCreate) {
    // A literal key, never equal to a category id, so Enter on a selected
    // name cannot be mistaken for the create action.
    rows.push({
      key: `${CREATE_PREFIX}${needle}`,
      text: trimmed,
      node: (
        <span className="flex items-baseline justify-between gap-3 text-sm">
          <span className="truncate">
            {trimmed ? (
              <>
                Create <span className="font-medium">{trimmed}</span>
              </>
            ) : (
              <span className="text-default-600">
                Type a name to add a new category
              </span>
            )}
          </span>
          {creatingName !== null && <Spinner size="sm" />}
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
      description={
        onCreate
          ? "Not in the list? Type its name and choose Create."
          : undefined
      }
      variant="bordered"
      radius="sm"
      size="sm"
      menuTrigger="focus"
      items={rows}
      selectedKey={value || null}
      defaultFilter={() => true}
      // An empty collection would collapse the popover and take the loading,
      // error and create states inside it with it.
      allowsEmptyCollection
      onSelectionChange={(key: Key | null) => {
        if (key === null) return;

        const next = String(key);

        if (next.startsWith(CREATE_PREFIX)) {
          if (trimmed) void create(trimmed);

          return;
        }

        setCreateError(undefined);
        onChange(next);
        // The field keeps the chosen name in its search box once it closes.
        // HeroUI reads the display item from the open collection, so clearing
        // the text on blur would leave the trigger without the category the
        // writer just picked.
        close(rows.find((row) => row.key === next)?.text);
      }}
      onOpenChange={setIsOpen}
      inputValue={shownValue}
      onInputChange={(next) => {
        setQuery(next);
        // The message belonged to the name that was there a moment ago.
        if (createError) setCreateError(undefined);
      }}
      onClear={() => onChange("")}
      isDisabled={isDisabled || creatingName !== null}
      isInvalid={isInvalid || Boolean(createError)}
      errorMessage={createError || errorMessage}
      classNames={{
        popoverContent: "border border-default-100",
      }}
      listboxProps={{ emptyContent: "\u00a0" }}
    >
      {({ key, text, status, node }) => (
        <AutocompleteItem
          key={key}
          textValue={
            key.startsWith(CREATE_PREFIX) && text ? `Create ${text}` : text
          }
          isDisabled={status}
          className={
            key.startsWith(CREATE_PREFIX)
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
