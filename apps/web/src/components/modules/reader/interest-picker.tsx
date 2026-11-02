"use client";

import { useCategoryList } from "@/hooks/category.hook";
import { useMemo, useState } from "react";
import { focusRing } from "@/components/modules/admin/kit/tau";

/**
 * The categories a reader can pick from, as tick boxes.
 *
 * A button list rather than a multi-select: every option stays visible and one
 * tap is one answer, which is what a phone needs. The choice is held by the
 * caller, so the same control serves the interests step and the profile.
 *
 * The list is the one the composer already reads, so a category created today
 * is offered here today. An empty list is a real state: there is nothing to
 * choose from yet, and the caller decides what to say about it.
 */
const InterestPicker = ({
  selected,
  onChange,
  disabled,
  label = "What do you want to read about?",
}: {
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  label?: string;
}) => {
  const { categories, isLoading, isError, refetch } = useCategoryList();
  const [filter, setFilter] = useState("");

  const chosen = useMemo(() => new Set(selected), [selected]);

  const visible = useMemo(() => {
    const term = filter.trim().toLowerCase();
    const list = term
      ? categories.filter((category) =>
          category.name.toLowerCase().includes(term),
        )
      : categories;

    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [categories, filter]);

  const toggle = (id: string) => {
    onChange(
      chosen.has(id) ? selected.filter((value) => value !== id) : [...selected, id],
    );
  };

  if (isLoading) {
    return (
      <div className="grid gap-2 sm:grid-cols-2" aria-busy="true">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-11 animate-pulse rounded-[6px] bg-default-100"
          />
        ))}
        <p className="sr-only" role="status">
          Loading the categories
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-default/60 px-4 py-3 text-sm text-default-600"
      >
        <span>The list of topics did not load.</span>
        <button
          type="button"
          onClick={() => refetch()}
          className={`inline-flex min-h-11 items-center rounded-[6px] border border-default-300 px-3 font-medium text-foreground hover:bg-default-100 ${focusRing}`}
        >
          Try again
        </button>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <p className="rounded-[10px] border border-default/60 px-4 py-3 text-sm text-default-600">
        There are no topics to choose from yet. Pick them later from your
        profile.
      </p>
    );
  }

  return (
    <div>
      {categories.length > 8 && (
        <label className="mb-3 block">
          <span className="sr-only">Filter the topics</span>
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter topics"
            className={`min-h-11 w-full rounded-[6px] border border-default-300 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-default-600 ${focusRing}`}
          />
        </label>
      )}

      <fieldset disabled={disabled}>
        <legend className="sr-only">{label}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {visible.map((category) => {
            const isOn = chosen.has(category._id);

            return (
              <label
                key={category._id}
                className={`group relative flex min-h-11 cursor-pointer items-center gap-3 rounded-[6px] border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-focus has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background ${
                  isOn
                    ? // The picked row goes quiet and the tick carries the
                      // accent: amber in its fill role, the same language as the
                      // primary button, with the ink tick on top.
                      "border-default-300 bg-default-100 font-medium text-foreground"
                    : "border-default-300 text-default-700 hover:bg-default-100"
                }`}
              >
                {/* The box is drawn, with the browser's own control hidden
                    behind it: one tick style that matches the site in both
                    themes, instead of the platform's square and its colour. */}
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(category._id)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] border transition-colors peer-disabled:opacity-60 ${
                    isOn
                      ? "border-primary bg-primary"
                      : "border-default-400 bg-transparent group-hover:border-default-500"
                  }`}
                >
                  {isOn && (
                    <svg
                      viewBox="0 0 12 12"
                      className="size-3 text-primary-foreground"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="square"
                    >
                      <path d="M2.5 6.2 4.8 8.5 9.5 3.6" />
                    </svg>
                  )}
                </span>
                <span className="min-w-0 grow truncate">{category.name}</span>
                {/* Real count of what exists to read, so the choice is an
                    informed one. Hidden at zero: "nothing here yet" is not a
                    number that helps the pick. */}
                {category.blogCount > 0 && (
                  <span className="shrink-0 text-xs tabular-nums text-default-600">
                    {category.blogCount}{" "}
                    {category.blogCount === 1 ? "article" : "articles"}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      {visible.length === 0 && (
        <p className="mt-3 text-sm text-default-600">
          No topic matches “{filter.trim()}”.
        </p>
      )}
    </div>
  );
};

export default InterestPicker;
