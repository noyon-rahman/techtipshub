"use client";

import { useComposerEditor } from "@/components/editor/rich-text-editor";
import { focusRing } from "@/components/modules/admin/kit/tau";
import { useCreateAdminBlog } from "@/hooks/admin-blogs";
import { useAdminMembers } from "@/hooks/admin-members";
import type { IAdminList, IAdminListResult } from "@/hooks/admin-list";
import { useCategoryList } from "@/hooks/category.hook";
import { adminManageBlogsPath } from "@/lib/blog-routes";
import { IUser } from "@/types";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useRef, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { LuEye, LuTriangleAlert } from "react-icons/lu";
import { RiArrowDownSLine } from "react-icons/ri";
import { toast } from "sonner";
import {
  BlogFormData,
  DraftField,
  EMPTY_DRAFT,
  buildBlogPayload,
  describeFailure,
  hasDraftContent,
  validateDraft,
  wordCount,
} from "../../modules/write-blog/composer-utils";
import CoverUpload from "../../modules/write-blog/cover-upload";
import {
  BottomActions,
  COMMON_TAGS,
  ComposerToolbar,
  EditorBody,
  EditorShell,
  PreviewModal,
  PublishingDetails,
  StatusMark,
  WritingPane,
} from "../../modules/write-blog/editor-shell";
import { useObjectUrl } from "../../modules/write-blog/use-stored-upload";
import { useUnsavedChangesGuard } from "../../modules/write-blog/use-unsaved-changes-guard";

/** How many members the author picker offers per search. */
const AUTHOR_LIMIT = 20;

const displayName = (member: Partial<IUser>) =>
  member.fullName?.trim() ||
  (member.username ? `@${member.username}` : "Unnamed member");

/**
 * The admin composer, at `/admin/manage-blogs/new`.
 *
 * The same writing surface as `/blogs/new` (the editor shell, the cover band,
 * the publishing rail), with the two choices only an admin makes: whose byline
 * the article carries, and whether it goes live now or waits as a draft in that
 * author's account.
 *
 * The draft is saved on the server, not in this browser: "draft for the author"
 * has to mean something the author can open from their own list, so a local
 * copy would defeat the point.
 */
const AdminComposer = () => {
  const router = useRouter();
  const { mutate: createBlog, isPending } = useCreateAdminBlog();

  const [values, setValues] = useState<BlogFormData>(EMPTY_DRAFT);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const coverUrl = useObjectUrl(coverImage);

  const [authorId, setAuthorId] = useState("");
  const [authorSearch, setAuthorSearch] = useState("");
  // The author error is raised on the first save attempt, not before the admin
  // has had a chance to pick one.
  const [authorTried, setAuthorTried] = useState(false);

  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  // Once a save has landed the guard stops asking about work that is already on
  // the server. State, not a ref: the guard is configured during render.
  const [saved, setSaved] = useState(false);

  const titleRef = useRef<HTMLTextAreaElement>(null);

  const members = useAdminMembers({
    limit: AUTHOR_LIMIT,
    searchTerm: authorSearch.trim() || undefined,
    status: "Active",
  });

  // An admin makes categories in the admin panel, so this field offers the list
  // with its loading and failure states and no way to ask for one.
  const categoryList = useCategoryList();

  const update = <K extends keyof BlogFormData>(
    key: K,
    value: BlogFormData[K],
  ) => {
    setValues((current) => ({ ...current, [key]: value }));

    // A field clears its own error as soon as it holds a value; it is checked
    // again on save. Emptying a required field keeps the error.
    const filled =
      key === "tags"
        ? Array.isArray(value) && value.length > 0
        : typeof value === "string" && value.trim() !== "";
    if (!filled) return;

    const field = key as DraftField;
    setErrors((current) =>
      current[field] ? { ...current, [field]: undefined } : current,
    );
  };

  const onChange = (html: string) => update("content", html);
  const editor = useComposerEditor({ value: values.content, onChange });

  const authorError =
    authorTried && !authorId ? "Choose the member this article is for." : null;

  /* --------------------------------------------------------------- actions */

  // The publishing rail renders twice, in the rail and under the piece; only
  // one copy is visible, so a field is found by layout rather than by id.
  const findVisible = (selector: string) =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
      (element) => element.getClientRects().length > 0,
    );

  const focusField = (field: DraftField | "author") => {
    if (field === "author") {
      findVisible("#admin-author")?.focus();
      return;
    }
    if (field === "content") {
      editor?.chain().focus().run();
      return;
    }
    if (field === "category") {
      findVisible("#admin-category")?.focus();
      return;
    }
    if (field === "tags") {
      findVisible("#admin-tags")?.focus();
      return;
    }
    titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    titleRef.current?.focus();
  };

  const save = (publish: boolean) => {
    setAuthorTried(true);
    const found = validateDraft(values, Boolean(coverImage));
    setErrors(found);

    const missingAuthor = !authorId;

    if (missingAuthor) {
      focusField("author");
      toast.error("Choose the member this article is for.", {
        id: "admin-compose-check",
      });
      return;
    }

    const fields: DraftField[] = [
      "title",
      "cover",
      "content",
      "category",
      "tags",
    ];
    const firstField = fields.find((field) => found[field]);
    if (firstField) {
      focusField(firstField);
      toast.error(found[firstField], { id: "admin-compose-check" });
      return;
    }

    createBlog(
      buildBlogPayload(values, coverImage, { userId: authorId, publish }),
      {
        onSuccess: (data) => {
          // A refusal arrives as data with `success: false`; the work stays on
          // screen so it can be corrected rather than retyped.
          if (!data?.success) {
            toast.error(data?.message || "The article was not saved.", {
              id: "admin-compose-failed",
            });
            return;
          }

          setSaved(true);
          toast.success(
            publish
              ? values.access === "public"
                ? "Article published. Anyone can open it, signed in or not."
                : "Article published. Readers with an account can open it now."
              : "Draft saved. It is in the author's account.",
            { id: "admin-compose-saved" },
          );
          router.push(adminManageBlogsPath);
          router.refresh();
        },
        onError: (error) => {
          toast.error(describeFailure(error, "The article was not saved."), {
            id: "admin-compose-failed",
          });
        },
      },
    );
  };

  const discardAll = () => {
    setValues(EMPTY_DRAFT);
    setCoverImage(null);
    setAuthorId("");
    setPicked(null);
    setErrors({});
    setTagInput("");
    editor?.commands.setContent("", { emitUpdate: false });
  };

  const { prompt, askToLeave } = useUnsavedChangesGuard({
    dirty: hasDraftContent(values) && !saved,
    discard: discardAll,
    onLeave: () => router.push(adminManageBlogsPath),
    title: "Leave without saving?",
    description:
      "This article has not been saved to the server yet. Leaving now loses it.",
  });

  /* ---------------------------------------------------------------- render */

  const tagSuggestions = useMemo(
    () => Array.from(new Set([...values.tags, ...COMMON_TAGS])),
    [values.tags],
  );

  const words = wordCount(values.content);

  // A member who is no longer in the searched page still has to keep their
  // name on the trigger until another one is chosen.
  const [picked, setPicked] = useState<IUser | null>(null);
  const chosenAuthor =
    members.rows.find((member) => member._id === authorId) ??
    picked ??
    undefined;

  const errorCount = Object.values(errors).filter(Boolean).length;

  const status =
    errorCount > 0 ? (
      <span className="font-medium text-danger">
        {errorCount} {errorCount === 1 ? "field needs" : "fields need"}{" "}
        attention
      </span>
    ) : chosenAuthor ? (
      <span className="text-default-600">
        The byline is {displayName(chosenAuthor)}
      </span>
    ) : (
      <span className="inline-flex items-center gap-2 text-warning-600 dark:text-warning">
        <StatusMark tone="warn" />
        Choose an author
      </span>
    );

  return (
    <EditorShell
      // Inside the admin shell the sticky bar belongs under its 3.5rem top bar,
      // not under the site header the member composer sits beneath.
      barStickyClass="top-[calc(3.5rem+1px)]"
      railStickyClass="lg:top-[calc(3.5rem+1px+3.5rem)]"
      onLeave={() => {
        if (!hasDraftContent(values) || saved) {
          router.push(adminManageBlogsPath);
          return;
        }
        askToLeave();
      }}
      leaveLabel="Articles"
      eyebrow="Admin: new article"
      status={status}
      actions={
        <>
          <Button
            size="sm"
            variant="bordered"
            startContent={<LuEye className="size-3.5" />}
            onPress={() => setPreviewOpen(true)}
          >
            Preview
          </Button>
          <Button
            size="sm"
            color="primary"
            isDisabled={isPending}
            onPress={() => save(true)}
          >
            Publish
          </Button>
        </>
      }
      sidebar={
        <div>
          <div className="mb-5">
            <AuthorPicker
              value={authorId}
              onChange={(member) => {
                setAuthorId(member._id);
                setPicked(member);
                setAuthorTried(false);
              }}
              search={authorSearch}
              onSearchChange={setAuthorSearch}
              members={members}
              chosen={chosenAuthor}
              error={authorError ?? undefined}
              isDisabled={isPending}
            />
          </div>

          <PublishingDetails
            idPrefix="admin"
            categories={categoryList.categories}
            category={values.category}
            onCategoryChange={(value) => update("category", value)}
            categoryError={errors.category}
            categoriesLoading={categoryList.isLoading}
            categoriesError={
              categoryList.isError
                ? categoryList.error?.message || "Categories did not load."
                : undefined
            }
            onRetryCategories={() => void categoryList.refetch()}
            tags={values.tags}
            onTagsChange={(next) => update("tags", next)}
            tagInput={tagInput}
            onTagInputChange={setTagInput}
            tagSuggestions={tagSuggestions}
            tagsError={errors.tags}
            onTagsRejected={(_raw, rejected) => {
              if (rejected.length) {
                toast.error("Add up to 8 tags, kept the first 8.", {
                  id: "admin-compose-tags-limit",
                });
              }
            }}
            access={values.access}
            onAccessChange={(access) => update("access", access)}
            footer={
              <p className="mt-5 border-t border-default-200 pt-4 text-xs leading-relaxed text-default-600">
                A draft is saved to the author&apos;s account, not to this
                browser. They can open it from their own article list.
              </p>
            }
          />
        </div>
      }
      footer={
        <BottomActions
          note="Publishing makes it live on the author's profile. Saving a draft keeps it private until it is published."
          onPreview={() => setPreviewOpen(true)}
          primary={
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => save(false)}
                disabled={isPending}
                className={`inline-flex min-h-11 items-center justify-center rounded-[6px] border border-default-300 px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-default-100 disabled:opacity-60 sm:min-h-9 ${focusRing}`}
              >
                Save draft
              </button>
              <Button
                color="primary"
                isDisabled={isPending}
                onPress={() => save(true)}
              >
                Publish
              </Button>
            </div>
          }
        />
      }
    >
      <WritingPane
        titleId="admin-title"
        titleRef={titleRef}
        title={values.title}
        titlePlaceholder="Title of the article"
        titleHint="Keep it specific. This is what readers scan for in the feed."
        onTitleChange={(value) => update("title", value)}
        titleError={errors.title}
        onTitleEnter={() => editor?.chain().focus("start").run()}
        coverLabel={coverImage ? "Cover image" : undefined}
        cover={
          <CoverUpload
            file={coverImage}
            onChange={(file) => {
              setCoverImage(file);
              if (file) {
                setErrors((current) => ({ ...current, cover: undefined }));
              }
            }}
            invalid={Boolean(errors.cover)}
          />
        }
        coverError={errors.cover}
        toolbar={<ComposerToolbar editor={editor} />}
        body={
          <div
            onFocusCapture={() => {
              if (errors.content) {
                setErrors((current) => ({ ...current, content: undefined }));
              }
            }}
          >
            <EditorBody editor={editor} invalid={Boolean(errors.content)} />
          </div>
        }
        bodyError={errors.content}
        bodyFooter={
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-default-200 pt-3 text-xs text-default-600">
            <span className="inline-flex items-center gap-1.5">
              <LuTriangleAlert aria-hidden className="size-3.5 shrink-0" />
              Draft or published, the article belongs to the author you choose.
            </span>
            <span className="tabular-nums">
              {words.toLocaleString()} {words === 1 ? "word" : "words"}
            </span>
          </div>
        }
      />

      <PreviewModal
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
        blog={{
          title: values.title,
          content: values.content,
          tags: values.tags,
          category: categoryList.categories.find(
            (item) => item._id === values.category,
          )?.name,
          coverUrl,
          authorName: chosenAuthor ? displayName(chosenAuthor) : undefined,
        }}
      />

      {prompt}
    </EditorShell>
  );
};

/**
 * The author picker: a search box over the member list.
 *
 * A plain select cannot hold a community's worth of accounts, so this is the
 * select-shaped trigger the admin toolbars use (`ListSelect`) opening a small
 * panel with the search field at its top. `useAdminMembers` is searched, not
 * filtered in the browser, because the list is paged: typing a name finds a
 * member on page 40 as easily as one on page 1.
 *
 * The chosen member's name is drawn by the trigger, so the button reads as a
 * value rather than a placeholder even after the search cleared.
 */
const AuthorPicker = ({
  value,
  onChange,
  search,
  onSearchChange,
  members,
  chosen,
  error,
  isDisabled,
}: {
  value: string;
  onChange: (member: IUser) => void;
  search: string;
  onSearchChange: (value: string) => void;
  members: IAdminList<IUser, IAdminListResult<IUser>>;
  chosen?: IUser;
  error?: string;
  isDisabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const hintId = useId();

  const close = () => {
    setOpen(false);
    onSearchChange("");
  };

  const detail = error ? (
    <span className="text-danger">{error}</span>
  ) : members.isError ? (
    "The member list did not load. Type to search again, or check that the API is running."
  ) : chosen ? (
    `The article appears on ${displayName(chosen)}'s profile.`
  ) : (
    "Type a name, username or email to find the member this article is for."
  );

  return (
    <div className="relative">
      <label
        id="admin-author-label"
        className="mb-1.5 block text-[0.8125rem] font-medium text-default-600"
      >
        Author
      </label>

      <button
        type="button"
        id="admin-author"
        aria-labelledby="admin-author-label admin-author"
        aria-describedby={hintId}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isDisabled}
        onClick={() => (open ? close() : setOpen(true))}
        className={`flex h-11 w-full items-center gap-2 rounded-[6px] border bg-background px-2.5 text-left text-sm transition-colors disabled:opacity-60 sm:h-9 ${
          error
            ? "border-danger"
            : "border-default-200 hover:border-default-300"
        } ${focusRing}`}
      >
        <span
          className={`min-w-0 flex-1 truncate ${
            chosen ? "text-foreground" : "text-default-500"
          }`}
        >
          {chosen ? displayName(chosen) : "Choose the author"}
        </span>
        <RiArrowDownSLine
          aria-hidden
          className={`size-4 shrink-0 text-default-600 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full z-40 mt-1 rounded-[8px] border border-default-200 bg-content1 p-1.5 shadow-lg">
          <input
            autoFocus
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                close();
              }
            }}
            placeholder="Search members"
            aria-label="Search members"
            className={`h-9 w-full rounded-[6px] border border-default-200 bg-background px-2.5 text-sm text-foreground placeholder:text-default-600 ${focusRing}`}
          />

          <ul
            role="listbox"
            aria-label="Members"
            className="mt-1.5 max-h-64 overflow-y-auto"
          >
            {members.isLoading ? (
              <li className="px-2.5 py-2 text-xs text-default-600">
                Loading members.
              </li>
            ) : members.isError ? (
              <li className="px-2.5 py-2 text-xs text-danger">
                Members did not load.
              </li>
            ) : members.rows.length === 0 ? (
              <li className="px-2.5 py-2 text-xs text-default-600">
                {search.trim()
                  ? `No active member matches "${search.trim()}".`
                  : "No members yet."}
              </li>
            ) : (
              members.rows.map((member) => {
                const selected = member._id === value;
                return (
                  <li key={member._id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(member);
                        close();
                      }}
                      className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-[5px] px-2.5 text-left text-sm transition-colors hover:bg-default-100 focus-visible:bg-default-100 ${
                        selected ? "text-primary-accessible" : "text-foreground"
                      } ${focusRing}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate">
                          {displayName(member)}
                        </span>
                        {member.username && (
                          <span className="block truncate text-xs text-default-600">
                            @{member.username}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <FiCheck aria-hidden className="size-4 shrink-0" />
                      )}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      <p
        id={hintId}
        className="mt-1.5 text-xs leading-relaxed text-default-600"
      >
        {detail}
      </p>
    </div>
  );
};

export default AdminComposer;
