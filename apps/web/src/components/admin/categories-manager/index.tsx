"use client";

import { formatCount } from "@/components/admin/format";
import {
  ListSelect,
  PAGE_SIZE_OPTIONS,
  PAGE_SIZES,
  quietButton,
  useDebouncedTerm,
} from "@/components/admin/list-controls";
import ConfirmDialog from "@/components/modules/admin/kit/confirm-dialog";
import DataTable from "@/components/modules/admin/kit/data-table";
import DataToolbar from "@/components/modules/admin/kit/data-toolbar";
import EmptyState from "@/components/modules/admin/kit/empty-state";
import FormDialog from "@/components/modules/admin/kit/form-dialog";
import ListFooter from "@/components/modules/admin/kit/list-footer";
import ListFrame from "@/components/modules/admin/kit/list-frame";
import { focusRing } from "@/components/modules/admin/kit/tau";
import {
  useAdminCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/admin-categories";
import type { ICategoryPayload } from "@/services/admin/categories";
import type { IAdminCategory } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input, Textarea } from "@heroui/react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { FiEdit2, FiPlus, FiSearch, FiTrash2 } from "react-icons/fi";
import { RiFolder3Line } from "react-icons/ri";
import { categoryValidationSchema, type TCategoryForm } from "./schema";

const COLUMNS = [
  { key: "name", header: "Category", className: "min-w-[16rem]" },
  { key: "count", header: "Articles", align: "right" as const },
  { key: "created", header: "Added", className: "whitespace-nowrap" },
  { key: "actions", header: "Actions", align: "right" as const },
];

const primaryButton = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[6px] bg-primary px-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-500 disabled:opacity-60 sm:min-h-9 ${focusRing}`;

const iconButton = `inline-flex size-11 items-center justify-center rounded-[6px] text-default-700 transition-colors hover:bg-default-100 hover:text-foreground sm:size-9 ${focusRing}`;

const linkClass = `rounded font-medium text-primary-accessible underline-offset-4 hover:underline ${focusRing}`;

/** An answer from the category endpoints. Failures arrive here as data. */
interface ICategoryReply {
  success?: boolean;
  message?: string;
  errorSources?: { message?: string }[];
}

const messageOf = (response: unknown, fallback: string) => {
  const payload = response as ICategoryReply | undefined;

  return payload?.errorSources?.[0]?.message || payload?.message || fallback;
};

/** A create or rename that lands on a name that is already taken (409). */
const isDuplicateName = (response: unknown) =>
  /already exists|duplicate/i.test(messageOf(response, ""));

const descriptionOf = (category: IAdminCategory) =>
  category.description?.trim() ?? "";

const countOf = (category: IAdminCategory) => category.blogCount ?? 0;

const formatDay = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "Not recorded";

type Tab = "all" | "unused";

/** The form dialog is open for a new category or for the one being renamed. */
type FormState =
  | { mode: "closed" }
  | { mode: "create" }
  | { mode: "edit"; category: IAdminCategory };

/**
 * Categories: the topics the feed filters by. The tab row separates the ones
 * articles are filed under from the unused ones, because an unused category is
 * the only one an admin can delete.
 *
 * Search goes to the API and the screen also matches the description, so one
 * phrase finds a category whichever field it lives in. The API pages nothing
 * here, so paging and tabs are applied to the filtered set on the client and
 * the footer count describes that same set.
 */
const CategoriesManager = ({
  createRequested,
  onCreateRequestedChange,
}: {
  /** The page header's "New category" button drives this dialog. */
  createRequested: boolean;
  onCreateRequestedChange: (open: boolean) => void;
}) => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState<number>(PAGE_SIZES[0]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [form, setForm] = useState<FormState>({ mode: "closed" });

  // One flag, so "creating from the header" and "renaming a row" can never be
  // true at once: when either opens, it takes the dialog over.
  const isFormOpen = createRequested || form.mode !== "closed";
  const editing = form.mode === "edit" ? form.category : null;

  const resetPage = useCallback(() => setPage(1), []);
  const searchTerm = useDebouncedTerm(query, resetPage);

  const list = useAdminCategories({ searchTerm });
  const { mutate: createCategory, isPending: isCreating } = useCreateCategory();
  const { mutate: updateCategory, isPending: isUpdating } = useUpdateCategory();
  const { mutate: deleteCategory, isPending: isDeleting } = useDeleteCategory();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<TCategoryForm>({
    resolver: zodResolver(categoryValidationSchema),
    defaultValues: { name: "", description: "" },
  });

  const { rows, isLoading, isError, error, refetch } = list;

  const needle = searchTerm.trim().toLowerCase();
  const matching = needle
    ? rows.filter((category) =>
        [category.name, descriptionOf(category)].some((value) =>
          value.toLowerCase().includes(needle),
        ),
      )
    : rows;

  const unused = matching.filter((category) => countOf(category) === 0);
  const visible = tab === "unused" ? unused : matching;

  const totalPages = Math.max(Math.ceil(visible.length / limit), 1);
  const pageStart = Math.min(
    (page - 1) * limit,
    Math.max(visible.length - 1, 0),
  );
  const pageRows = visible.slice(pageStart, pageStart + limit);

  const changeTab = (next: Tab) => {
    setTab(next);
    setPage(1);
  };

  const filters = [
    { key: "all", label: "All", count: matching.length },
    { key: "unused", label: "Unused", count: unused.length },
  ];

  const openCreate = () => {
    setForm({ mode: "create" });
    reset({ name: "", description: "" });
  };

  const openEdit = (category: IAdminCategory) => {
    onCreateRequestedChange(false);
    setForm({ mode: "edit", category });
    reset({ name: category.name, description: descriptionOf(category) });
  };

  const closeForm = () => {
    onCreateRequestedChange(false);
    setForm({ mode: "closed" });
  };

  const isSaving = isCreating || isUpdating;

  const onSubmit = handleSubmit((values) => {
    const name = values.name.trim();
    const description = values.description?.trim() ?? "";

    // The API validates the body strictly and rejects a blank description, so
    // the field is left out rather than sent empty.
    const next: ICategoryPayload = description
      ? { name, description }
      : { name };

    const settle = (reply: unknown) => {
      if ((reply as ICategoryReply | undefined)?.success) {
        closeForm();
        return;
      }

      if (isDuplicateName(reply)) {
        setError("name", {
          type: "server",
          message:
            "A category with this name already exists. Pick another name.",
        });
        setFocus("name");
        return;
      }

      setError("description", {
        type: "server",
        message: messageOf(reply, "The category could not be saved."),
      });
      setFocus("description");
    };

    if (editing) {
      updateCategory({ id: editing._id, payload: next }, { onSuccess: settle });
    } else {
      createCategory(next, { onSuccess: settle });
    }
  });

  const emptyState = isError ? (
    <EmptyState
      variant="inline"
      icon={<RiFolder3Line className="size-5" />}
      title="Categories could not be loaded"
      description={
        error?.message ||
        "The request failed. Check that the API is running, then try again."
      }
      action={
        <button
          type="button"
          onClick={() => void refetch()}
          className={quietButton}
        >
          Try again
        </button>
      }
    />
  ) : needle ? (
    <EmptyState
      variant="inline"
      icon={<FiSearch className="size-5" />}
      title="No category matches this search"
      description={`No category has "${searchTerm}" in its name or description. Try a shorter word, or clear the field.`}
      action={
        <button
          type="button"
          onClick={() => setQuery("")}
          className={quietButton}
        >
          Clear search
        </button>
      }
    />
  ) : tab === "unused" ? (
    <EmptyState
      variant="inline"
      icon={<RiFolder3Line className="size-5" />}
      title="Every category is in use"
      description="Nothing here can be deleted yet: each category has at least one published article filed under it."
      action={
        <button
          type="button"
          onClick={() => changeTab("all")}
          className={quietButton}
        >
          Show all categories
        </button>
      }
    />
  ) : (
    <EmptyState
      variant="inline"
      icon={<RiFolder3Line className="size-5" />}
      title="No categories yet"
      description="Authors pick a category when they publish. Add the first one so their articles have a place in the feed."
      action={
        <button type="button" onClick={openCreate} className={primaryButton}>
          <FiPlus aria-hidden className="size-4" />
          Add the first category
        </button>
      }
    />
  );

  return (
    <>
      <ListFrame label="Categories">
        <DataToolbar
          filters={filters}
          activeFilter={tab}
          onFilterChange={(key) =>
            changeTab(key === "unused" ? "unused" : "all")
          }
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Name or description"
          right={
            <ListSelect
              label="Per page"
              hideLabel
              value={limit}
              onChange={(value) => {
                setLimit(Number(value) || PAGE_SIZES[0]);
                setPage(1);
              }}
              options={PAGE_SIZE_OPTIONS}
            />
          }
        />

        <DataTable
          columns={COLUMNS}
          rows={pageRows}
          getRowKey={(row) => row._id}
          isLoading={isLoading}
          skeletonRows={Math.min(limit, 10)}
          minWidth="40rem"
          caption="Categories, how many published articles use each, and when each was added"
          emptyState={emptyState}
          renderCell={(category, columnKey) => {
            const used = countOf(category);

            switch (columnKey) {
              case "name":
                return (
                  <div className="max-w-[28rem]">
                    <Link
                      href={`/?category=${encodeURIComponent(category.name)}`}
                      className={linkClass}
                    >
                      {category.name}
                    </Link>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-default-600">
                      {descriptionOf(category) || "No description"}
                    </p>
                  </div>
                );

              case "count":
                return (
                  <span>
                    {used > 0 ? (
                      formatCount(used)
                    ) : (
                      <span className="text-default-600">None</span>
                    )}
                  </span>
                );

              case "created":
                return (
                  <span className="text-xs tabular-nums text-default-600">
                    {formatDay(category.createdAt)}
                  </span>
                );

              case "actions":
                return (
                  <div className="flex items-center justify-end gap-0.5">
                    <button
                      type="button"
                      onClick={() => openEdit(category)}
                      aria-label={`Edit ${category.name}`}
                      className={iconButton}
                    >
                      <FiEdit2 aria-hidden className="size-4" />
                    </button>

                    {used > 0 ? (
                      <button
                        type="button"
                        disabled
                        aria-label={`Delete ${category.name}`}
                        title={`${used} published ${
                          used === 1 ? "article uses" : "articles use"
                        } this category, so it cannot be deleted until they are moved or removed.`}
                        className={`${iconButton} cursor-not-allowed text-default-400 hover:bg-transparent hover:text-default-400`}
                      >
                        <FiTrash2 aria-hidden className="size-4" />
                      </button>
                    ) : (
                      <ConfirmDialog
                        trigger={
                          <button
                            type="button"
                            aria-label={`Delete ${category.name}`}
                            className={`${iconButton} text-danger hover:bg-danger/10 hover:text-danger`}
                          >
                            <FiTrash2 aria-hidden className="size-4" />
                          </button>
                        }
                        title={`Delete ${category.name}?`}
                        description="It stops appearing in the feed filter and in the category picker. No articles use it, so nothing is left without a category."
                        confirmLabel="Delete category"
                        tone="danger"
                        isPending={isDeleting}
                        onConfirm={() =>
                          deleteCategory(category._id, {
                            onSuccess: () => {
                              if (page > 1 && pageRows.length <= 1) {
                                setPage((current) => Math.max(1, current - 1));
                              }
                            },
                          })
                        }
                      />
                    )}
                  </div>
                );

              default:
                return null;
            }
          }}
        />

        <ListFooter
          total={isError || isLoading ? undefined : visible.length}
          shown={pageRows.length}
          noun="category"
          page={page}
          totalPages={totalPages}
          pageSize={limit}
          onPageChange={setPage}
          isLoading={isLoading && pageRows.length === 0}
          isError={isError}
          context={
            needle
              ? `, matching "${searchTerm}"`
              : tab === "unused"
                ? ", unused"
                : null
          }
        />
      </ListFrame>

      <FormDialog
        isOpen={isFormOpen}
        onClose={closeForm}
        title={editing ? `Edit ${editing.name}` : "New category"}
        description={
          editing
            ? "The articles filed here keep their place when the name changes."
            : "Readers scan these names in the feed filter, so keep the name short."
        }
        onSubmit={() => void onSubmit()}
        isPending={isSaving}
        submitLabel={editing ? "Save changes" : "Create category"}
        closeLabel={editing ? "Cancel" : "Close"}
      >
        <Input
          label="Name"
          labelPlacement="outside"
          placeholder="React, career advice, dev tooling"
          autoComplete="off"
          isRequired
          isDisabled={isSaving}
          isInvalid={!!errors.name}
          errorMessage={errors.name?.message}
          {...register("name")}
        />
        <Textarea
          label="Description"
          labelPlacement="outside"
          placeholder="What belongs in this category"
          description="Optional. Leave it empty and the category shows only its name."
          minRows={3}
          maxRows={6}
          isDisabled={isSaving}
          isInvalid={!!errors.description}
          errorMessage={errors.description?.message}
          {...register("description")}
        />
      </FormDialog>
    </>
  );
};

export default CategoriesManager;
