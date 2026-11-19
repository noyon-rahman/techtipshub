"use client";

import { useComposerEditor } from "@/components/editor/rich-text-editor";
import { useUser } from "@/context/user.provider";
import { useCreateBlog } from "@/hooks/blog.hook";
import {
  useCategoryList,
  useCreateCategoryForComposer,
} from "@/hooks/category.hook";
import {
  editBlogPath,
  manageBlogsPath,
  writeBlogPath,
} from "@/lib/blog-routes";
import { Button } from "@heroui/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LuClock, LuEye, LuTrash2 } from "react-icons/lu";
import { toast } from "@/lib/toast";
import {
  BlogFormData,
  DraftField,
  buildBlogJson,
  clearDraft,
  describeFailure,
  draftFingerprint,
  EMPTY_DRAFT,
  formatSavedAt,
  hasDraftContent,
  loadDraft,
  saveDraft,
  validateDraft,
  validateUploadSize,
  wordCount,
} from "./composer-utils";
import CoverUpload from "./cover-upload";
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
  categoryName,
} from "./editor-shell";
import { useObjectUrl, useStoredUpload } from "./use-stored-upload";
import { useCoverAsset } from "./use-cover-asset";
import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";

const AUTOSAVE_DELAY = 1200;

/**
 * An unsaved draft found on load.
 *
 * Read lazily during the first client render, never during server rendering,
 * so the page can offer to restore it and the autosave effect knows not to
 * overwrite it with the empty page before the writer decides.
 */
let pendingDraft: ReturnType<typeof loadDraft> = null;
let pendingDraftRead = false;

/** Where this browser keeps the composer's unfinished draft and its cover. */
const DRAFT_COVER_KEY = "draft";

const readPendingDraft = () => {
  if (typeof window === "undefined") return null;
  if (!pendingDraftRead) {
    pendingDraftRead = true;
    const draft = loadDraft();
    pendingDraft = draft && hasDraftContent(draft.values) ? draft : null;
  }
  return pendingDraft;
};

/** True when this draft has something worth keeping. */
const isDirty = hasDraftContent;

/** "412 words, about 2 min read", so the writer knows the size of the piece. */ const statusLine =
  (values: BlogFormData) => {
    const words = wordCount(values.content);
    if (!words) return "0 words";
    // 200 words a minute is a normal reading pace for technical prose.
    const minutes = Math.max(1, Math.round(words / 200));
    return `${words.toLocaleString()} ${words === 1 ? "word" : "words"}, about ${minutes} min read`;
  };

/**
 * The composer, at `/blogs/new`.
 *
 * A cover strip, the formatting tools, the title and the writing surface in one
 * measured column, with the required publishing details beside it rather than
 * hidden behind a disclosure. The bar holds what stays true while scrolling:
 * the way out, the state of the draft, and the next step.
 *
 * The frame comes from `EditorShell`, which the article editor uses too, so the
 * two screens are the same tool in the same places.
 */
const WriteBlog = () => {
  const router = useRouter();
  const { mutate: createBlog, isPending } = useCreateBlog();
  // Writing is open to guests; only publishing needs an account.
  const { user, isLoading: userLoading } = useUser();
  const categoryList = useCategoryList();
  // A member adds the category they need from the field itself; a guest writes
  // drafts only, so the field stays a list for them.
  const createCategory = useCreateCategoryForComposer();

  const [values, setValues] = useState<BlogFormData>(EMPTY_DRAFT);
  // The file is kept with the draft so a reload can show it and upload it
  // again. Only the file is stored: an uploaded URL belongs to the asset that
  // will be deleted if the draft is, so a reload must never treat one as a
  // cover it can publish.
  const {
    file: pickedFile,
    setFile: setPickedFile,
    sync: syncCover,
  } = useStoredUpload(DRAFT_COVER_KEY);
  // The file as it was picked is what the strip previews, before and after its
  // upload, so replacing never blanks the image the writer is looking at.
  const previewFile = pickedFile;
  const previewUrl = useObjectUrl(previewFile);

  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Partial<Record<DraftField, string>>>({});
  const [previewOpen, setPreviewOpen] = useState(false);
  // Reading a draft happens during the first client render only; the server
  // render has no storage, so both start empty and the banner appears on mount.
  const [recovered, setRecovered] = useState(() => Boolean(readPendingDraft()));
  const [savedAt, setSavedAt] = useState(
    () => readPendingDraft()?.savedAt ?? null,
  );
  // Set while a publish is in flight so the autosave cannot race the request.
  const publishedRef = useRef(false);
  // A cover restored from storage was uploaded and deleted when the last visit
  // ended, so it has to go out again if the writer keeps this draft.
  const coverReuploadedRef = useRef(false);
  // Set by the writer's own pick, which must never be sent a second time by the
  // restore above.
  const pickedByWriter = useRef(false);

  const recoveredRef = useRef(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  const valuesRef = useRef(values);
  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const update = useCallback(
    <K extends keyof BlogFormData>(key: K, value: BlogFormData[K]) => {
      setValues((current) => ({ ...current, [key]: value }));
      // Clear the field's error as soon as it holds a value; it is re-checked on
      // publish. Emptying a required field leaves the error until then.
      const filled =
        key === "tags"
          ? Array.isArray(value) && value.length > 0
          : typeof value === "string" && value.trim() !== "";
      if (!filled) return;
      const field = key as DraftField;
      setErrors((current) =>
        current[field] ? { ...current, [field]: undefined } : current,
      );
    },
    [],
  );

  const onChange = useCallback(
    (html: string) => update("content", html),
    [update],
  );

  const editor = useComposerEditor({ value: values.content, onChange });

  // Picking a cover uploads it at once; the asset is what publish sends, and
  // the file is only the preview from here on.
  const pickCover = (file: File) => {
    pickedByWriter.current = true;
    setPickedFile(file);
    setErrors((current) => ({ ...current, cover: undefined }));
    void pickAsset(file);
  };

  // Removing the current cover deletes the asset; nothing on this screen is
  // saved yet, so there is no stored cover to protect.
  const removeCover = () => {
    pickedByWriter.current = true;
    dropAsset();
    setPickedFile(null);
    void syncCover(null);
  };

  /* ---------------------------------------------------------------- effects */

  // Autosave. The stored draft is only written once the writer has answered the
  // restore banner, so an empty page cannot overwrite a recoverable draft.
  useEffect(() => {
    if (pendingDraft && !recoveredRef.current) return;
    if (!isDirty(values) || publishedRef.current) return;

    const timer = window.setTimeout(() => {
      saveDraft(valuesRef.current);
      setSavedAt(Date.now());
    }, AUTOSAVE_DELAY);

    return () => window.clearTimeout(timer);
  }, [values]);

  // A cover restored from storage belongs to the stored draft. When the writer
  // starts writing something else, it is not theirs to publish, so it is dropped.
  const storedDraftFingerprint = useMemo(
    () => (pendingDraft ? draftFingerprint(pendingDraft.values) : null),
    [],
  );
  const [coverClearedFor, setCoverClearedFor] = useState<string | null>(null);
  const liveFingerprint = draftFingerprint(values);
  if (
    pickedFile &&
    storedDraftFingerprint &&
    liveFingerprint !== storedDraftFingerprint &&
    coverClearedFor === null
  ) {
    setCoverClearedFor(liveFingerprint);
  }
  const showCover = coverClearedFor === null;
  const coverFile = showCover ? pickedFile : null;

  // The cover follows the draft. There is one draft at a time, so one key; an
  // effect writes the chosen file back and clears it when it is removed.
  useEffect(() => {
    if (publishedRef.current) return;
    void syncCover(coverFile);
    // `syncCover` is stable; `coverFile` is the input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverFile]);

  // A cover can only be uploaded for a member: the API refuses the upload for
  // a guest, and losing the whole article over a blocked one is the worse
  // trade. `userLoading` keeps the picker shut until that is known, so a
  // member's file is never thrown away by the opening render.
  const canUploadCover = Boolean(user) || userLoading;
  const {
    asset: coverAsset,
    status: coverStatus,
    progress: coverProgress,
    failedMessage: coverFailure,
    pick: pickAsset,
    drop: dropAsset,
    keep: keepAsset,
  } = useCoverAsset();

  // The restored file has no asset behind it, because the asset was deleted
  // when the last visit ended, so it goes up again once the writer moves on
  // with the draft. The strip shows the file while it waits, which keeps the
  // cover check reading it the same way.
  useEffect(() => {
    if (!coverFile || !canUploadCover || !user) return;
    if (coverAsset || coverStatus === "uploading") return;
    if (!coverReuploadedRef.current) {
      coverReuploadedRef.current = true;
      void pickAsset(coverFile);
      return;
    }
    // The writer answered the restore banner by keeping the draft. A cover the
    // writer just picked is not the restored one, so it waits for none.
    if (recoveredRef.current && !pickedByWriter.current) {
      void pickAsset(coverFile);
    }
  }, [
    coverFile,
    canUploadCover,
    user,
    recovered,
    coverAsset,
    coverStatus,
    pickAsset,
  ]);

  // "Saved just now" should age while the page stays open.
  useEffect(() => {
    if (!savedAt) return;
    const timer = window.setInterval(() => setSavedAt((time) => time), 15000);
    return () => window.clearInterval(timer);
  }, [savedAt]);

  // Keep the very last keystrokes even if the writer closes the tab at once.
  useEffect(
    () => () => {
      if (!publishedRef.current && isDirty(valuesRef.current)) {
        saveDraft(valuesRef.current);
      }
    },
    [],
  );

  /* --------------------------------------------------------------- actions */

  const restoreDraft = () => {
    const draft = pendingDraft;
    if (!draft) return;
    pendingDraft = null;
    recoveredRef.current = true;
    setValues(draft.values);
    setSavedAt(draft.savedAt);
    setRecovered(false);
    toast.success("Draft restored");
  };

  const discardDraft = () => {
    pendingDraft = null;
    recoveredRef.current = true;
    clearDraft();
    void syncCover(null);
    setPickedFile(null);
    // The restored file was uploaded again; nobody will publish it now.
    dropAsset();
    setRecovered(false);
    setSavedAt(null);
    toast.success("Local draft removed");
  };

  const resetEverything = () => {
    pendingDraft = null;
    recoveredRef.current = true;
    clearDraft();
    void syncCover(null);
    setValues(EMPTY_DRAFT);
    setPickedFile(null);
    // A fresh draft starts with no cover; the one that was here goes.
    dropAsset();
    pickedByWriter.current = false;
    setTagInput("");
    setSavedAt(null);
    setRecovered(false);
    setErrors({});
    editor?.commands.setContent("", { emitUpdate: false });
  };

  // The details panel is rendered twice, once in the rail and once under the
  // piece; only one copy is visible, so the field is found by layout, not id.
  const findVisible = (selector: string) =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)).find(
      (element) => element.getClientRects().length > 0,
    );

  const focusField = (field: DraftField) => {
    if (field === "content") {
      editor?.chain().focus().run();
      return;
    }

    if (field === "title") {
      titleRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      titleRef.current?.focus();
      return;
    }
    if (field === "cover") {
      const cover = findVisible("#composer-cover");
      cover?.scrollIntoView({ behavior: "smooth", block: "center" });
      cover?.focus();
      return;
    }
    if (field === "category") {
      const trigger = findVisible('[id$="-category"]');
      trigger?.scrollIntoView({ behavior: "smooth", block: "center" });
      trigger?.focus();
      trigger?.click();
      return;
    }
    const tags = findVisible('[id$="-tags"]');
    tags?.scrollIntoView({ behavior: "smooth", block: "center" });
    tags?.focus();
  };

  const publish = async () => {
    if (coverStatus === "uploading" || isPending) return;

    // Only an uploaded asset counts as a cover. A file whose upload failed, or
    // one still waiting to be sent again, is not a cover yet, so it must not
    // pass this check and let a publish go out without one.
    const found = validateDraft(values, Boolean(coverAsset));
    // A failed upload has its own sentence; "add a cover image" would hide the
    // reason the writer already has on screen under the strip.
    if (found.cover && coverFile && coverFailure) found.cover = coverFailure;
    setErrors(found);

    const first = (
      ["title", "cover", "content", "category", "tags"] as DraftField[]
    ).find((field) => found[field]);

    if (first) {
      focusField(first);
      toast.error(found[first], { id: "publish-check" });
      return;
    }

    // A guest can write the whole piece; publishing needs an account. The
    // draft is saved first, so signing in and coming back loses nothing.
    if (!userLoading && !user) {
      saveDraft(values);
      router.push(`/login?redirect=${encodeURIComponent(writeBlogPath)}`);
      return;
    }

    // Checked before the request: the server's answer to an oversized article
    // is a bare 413 with no field to point at, and the draft must not be lost
    // to it while the writer is still looking at the screen.
    const tooBig = validateUploadSize(values);
    if (tooBig) {
      toast.error(tooBig, { id: "publish-check" });
      return;
    }

    // The cover went up when it was picked, so publish only names it. A file
    // without an asset here means the strip promised one the upload never
    // delivered, which is the same failure the check above describes.
    if (!coverAsset) {
      toast.error("Wait for the cover to finish uploading, or pick it again.", {
        id: "cover-upload-failed",
        description: coverFailure ?? undefined,
      });
      focusField("cover");
      return;
    }

    publishedRef.current = true;
    createBlog(buildBlogJson(values, coverAsset.url), {
      onSuccess: (data) => {
        // A failed publish keeps the draft and the cover, so the writer can
        // fix the problem instead of losing the work.
        if (!data?.success) {
          publishedRef.current = false;
          toast.error(data?.message || "The blog was not published.", {
            id: "publish-failed",
            description: "Your draft is still here. Nothing was lost.",
          });
          return;
        }
        // The cover is the article's now, so this screen must not delete it.
        keepAsset();
        resetEverything();
        const slug = data?.data?.slug as string | undefined;
        // Straight to the editor where the new blog lives, or the feed.
        router.push(slug ? editBlogPath(slug) : manageBlogsPath);
        router.refresh();
      },
      onError: (error) => {
        publishedRef.current = false;
        toast.error(describeFailure(error, "Publishing did not finish."), {
          id: "publish-failed",
          description: "Your draft is still here.",
        });
      },
    });
  };

  const leave = () => {
    if (isDirty(values)) saveDraft(values);
    // Guests have no article list to go back to.
    router.push(user ? manageBlogsPath : "/");
  };

  const { prompt, askToLeave } = useUnsavedChangesGuard({
    dirty: isDirty(values),
    // "Leave" throws the draft away, so the cover that was uploaded for it has
    // nobody left to publish it. The unmount cleanup is the backstop for the
    // other ways out; this is the one that can run before it.
    discard: () => {
      clearDraft();
      void syncCover(null);
      setPickedFile(null);
      dropAsset();
    },
    onLeave: () => router.push(manageBlogsPath),
    title: "Leave this draft?",
    description:
      "Your unfinished draft is kept in this browser, so you can pick it up where you left off.",
  });

  // Making a category is the member's own step: it happens the moment they
  // confirm the name, and the field selects it before this returns, so the
  // draft is filed under a live category like any other.
  const createCategoryInField = async (name: string) => {
    try {
      const category = await createCategory.mutateAsync({ name });
      toast.success(`Added ${category.name}.`, { id: "category-created" });

      return category._id;
    } catch (failure) {
      // The field says the category did not appear; the toast carries the
      // reason from the API (a name already in use, a name too short).
      toast.error(
        failure instanceof Error && failure.message
          ? failure.message
          : "The category could not be created.",
        { id: "category-create" },
      );

      return undefined;
    }
  };

  /* ---------------------------------------------------------------- render */

  const tagSuggestions = useMemo(
    () => Array.from(new Set([...values.tags, ...COMMON_TAGS])),
    [values.tags],
  );

  const savedLabel = savedAt ? formatSavedAt(savedAt) : "Saved as you type";
  const errorsPresent = Object.values(errors).filter(Boolean).length;

  // The cover that publish will send, if the strip is showing one.
  const addedCover = showCover && Boolean(coverFile || coverAsset);

  // The strip owns the cover's progress, so only publish is held back while it
  // runs: a publish sent mid-upload would go out without the cover's URL.
  const busy = isPending || coverStatus === "uploading";

  const status =
    errorsPresent > 0 ? (
      <span className="font-medium text-danger">
        {errorsPresent} {errorsPresent === 1 ? "field needs" : "fields need"}{" "}
        attention
      </span>
    ) : isDirty(values) ? (
      <span className="inline-flex items-center gap-2 text-default-600">
        <StatusMark tone="ok" />
        {savedAt ? savedLabel : "Draft kept in this browser"}
      </span>
    ) : (
      <span className="text-default-600">Nothing written yet</span>
    );

  return (
    <EditorShell
      onLeave={() => {
        // Leaving keeps the draft, so there is nothing to warn about until
        // there is actually text to walk away from.
        if (!isDirty(values)) {
          leave();
          return;
        }
        askToLeave();
      }}
      leaveLabel={user ? "My articles" : "Close"}
      eyebrow={user ? "New blog" : "New blog, publishing needs an account"}
      status={status}
      actions={
        <>
          {isDirty(values) && (
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              aria-label="Clear draft"
              className="hidden sm:flex"
              onPress={resetEverything}
            >
              <LuTrash2 className="size-4" />
            </Button>
          )}
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
            isDisabled={busy}
            isLoading={isPending}
            onPress={publish}
          >
            Publish
          </Button>
        </>
      }
      banner={
        recovered && pendingDraft ? (
          <div className="flex flex-col gap-3 border border-default-200 bg-default-50 px-4 py-3 text-sm sm:flex-row sm:items-center dark:bg-default-100/5">
            <div className="flex items-center gap-2 text-foreground">
              <LuClock
                aria-hidden
                className="size-4 shrink-0 text-default-600"
              />
              <span>
                You have an unpublished draft from{" "}
                {new Date(pendingDraft.savedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
                .
              </span>
            </div>
            <div className="flex gap-2 sm:ml-auto">
              <Button size="sm" color="primary" onPress={restoreDraft}>
                Restore draft
              </Button>
              <Button size="sm" variant="light" onPress={discardDraft}>
                Discard
              </Button>
            </div>
          </div>
        ) : null
      }
      sidebar={
        <PublishingDetails
          idPrefix="composer"
          categories={categoryList.categories}
          category={values.category}
          onCategoryChange={(value) =>
            setValues((current) => ({
              ...current,
              category: value,
              // The picker hands back an id, so the name is looked up from the
              // list in front of the writer at this moment. A restored draft
              // has no list to look in and keeps what it stored.
              categoryName: categoryName(
                { category: value },
                categoryList.categories,
              ),
            }))
          }
          categoryError={errors.category}
          categoriesLoading={categoryList.isLoading}
          categoriesError={
            categoryList.isError
              ? categoryList.error?.message || "Categories did not load."
              : undefined
          }
          onRetryCategories={() => void categoryList.refetch()}
          onCreateCategory={user ? createCategoryInField : undefined}
          categorySelectedName={
            categoryName(
              { category: values.category },
              categoryList.categories,
            ) ?? values.categoryName
          }
          tags={values.tags}
          onTagsChange={(next) => update("tags", next)}
          tagInput={tagInput}
          onTagInputChange={setTagInput}
          tagSuggestions={tagSuggestions}
          tagsError={errors.tags}
          onTagsRejected={(_raw, rejected) => {
            if (rejected.length) {
              toast.error("Add up to 8 tags, kept the first 8.", {
                id: "composer-tags-limit",
              });
            }
          }}
          access={values.access}
          onAccessChange={(access) => update("access", access)}
          footer={
            <p className="mt-5 border-t border-default-200 pt-4 text-xs leading-relaxed text-default-600">
              The draft stays in this browser until you publish. Only you can
              see it.
            </p>
          }
        />
      }
      footer={
        <BottomActions
          note={
            values.access === "public"
              ? "Publishing makes it live for everyone, with no sign-in."
              : "Publishing makes it live for members. Everyone else sees the opening and a sign-in prompt."
          }
          onPreview={() => setPreviewOpen(true)}
          primary={
            <Button
              color="primary"
              isDisabled={busy}
              isLoading={isPending}
              onPress={publish}
            >
              Publish
            </Button>
          }
        />
      }
    >
      <WritingPane
        titleId="composer-title"
        titleRef={titleRef}
        title={values.title}
        titlePlaceholder="Title of your article"
        titleHint="Keep it specific. This is what readers scan for in the feed."
        onTitleChange={(value) => update("title", value)}
        titleError={errors.title}
        onTitleEnter={() => editor?.chain().focus("start").run()}
        coverLabel={addedCover ? "Cover image" : undefined}
        cover={
          <CoverUpload
            file={coverFile}
            progress={
              coverStatus === "uploading" ? (coverProgress ?? null) : undefined
            }
            failedMessage={coverFailure}
            onChange={(file) => {
              if (file) pickCover(file);
              else removeCover();
            }}
            onRemoveExisting={removeCover}
            canPick={canUploadCover}
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
            <span>
              Start a line with{" "}
              <kbd className="rounded border border-default-200 px-1 font-mono">
                /
              </kbd>{" "}
              for headings, lists and code.
            </span>
            <span className="tabular-nums">{statusLine(values)}</span>
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
          category:
            categoryName(
              { category: values.category },
              categoryList.categories,
            ) ?? values.categoryName,
          coverUrl: showCover ? (coverAsset?.url ?? previewUrl) : null,
          authorName: user?.name,
        }}
      />

      {prompt}
    </EditorShell>
  );
};

export default WriteBlog;
