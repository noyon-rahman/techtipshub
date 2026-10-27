"use client";

import { focusRing } from "@/components/modules/admin/kit/tau";
import {
  useCampaignSuggestion,
  useCreateCampaign,
  usePreviewCampaign,
  useTestCampaign,
  useUpdateCampaign,
} from "@/hooks/admin-newsletter";
import type {
  ICampaign,
  ICampaignArticlePick,
  TCampaignInput,
} from "@/services/admin/newsletter";
import {
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Skeleton,
  Textarea,
} from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiCheck, FiMail, FiX } from "react-icons/fi";

import { primaryButton, quietButton } from "./buttons";

const MAX_ARTICLES = 40;
const MAX_SUBJECT = 150;
const MAX_PREVIEW = 140;
const MAX_HEADING = 120;
const MAX_INTRO = 2000;

interface IProps {
  /** The draft being edited. A new issue passes none. */
  draft?: ICampaign;
  onSaved: (id: string) => void;
  onCancel?: () => void;
  /** Saves the copy, so a preview of a new issue has something to render. */
  onRequestSend: () => void;
}

/**
 * The roundup builder.
 *
 * An issue is a subject, a heading, a short intro and a list of articles, not
 * a free-form document: the email template owns the layout, so every issue
 * looks like the last one and a typo cannot break the HTML.
 *
 * A new issue starts from the suggestion: the heading for this month, and
 * every article published since the last issue went out. That is what makes
 * the first issue (everything, ever) and every later one ("what readers
 * missed") the same piece of work.
 */
const CampaignEditor = ({
  draft,
  onSaved,
  onCancel,
  onRequestSend,
}: IProps) => {
  const isDraft = Boolean(draft);

  const [subject, setSubject] = useState(draft?.subject ?? "");
  const [preview, setPreview] = useState(draft?.preview ?? "");
  const [heading, setHeading] = useState(draft?.heading ?? "");
  const [intro, setIntro] = useState(draft?.intro ?? "");
  const [picked, setPicked] = useState<string[]>(
    draft?.articles.map((article) => article.blog) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // A draft's chosen articles are frozen copies; the suggestion only lists
  // published articles, so the two are merged for the picker to show.
  const frozen = useMemo(
    () =>
      (draft?.articles ?? []).map<ICampaignArticlePick>((article) => ({
        _id: article.blog,
        title: article.title,
        slug: undefined,
        coverImage: article.coverImage,
        category: article.category,
        createdAt: draft?.createdAt ?? new Date().toISOString(),
        href: article.href,
      })),
    [draft],
  );

  const suggestion = useCampaignSuggestion(!isDraft);
  const prefilled = useRef(isDraft);

  // A new issue fills itself once: the heading and the articles since the last
  // send. Editing one of those fields afterwards must not be overwritten by a
  // refetch, which is why this runs once.
  useEffect(() => {
    if (prefilled.current || !suggestion.data) return;
    prefilled.current = true;

    const data = suggestion.data;

    setHeading((current) => current || data.heading);
    setPicked((current) =>
      current.length > 0
        ? current
        : data.articles.slice(0, MAX_ARTICLES).map((article) => article._id),
    );
    setSubject((current) => current || `${data.heading} on TechTipsHub`);
  }, [suggestion.data]);

  const create = useCreateCampaign();
  const update = useUpdateCampaign();
  const previewMutation = usePreviewCampaign();
  const testMutation = useTestCampaign();

  const isSaving = create.isPending || update.isPending;

  const choices = useMemo(() => {
    const byId = new Map<string, ICampaignArticlePick>();
    for (const article of frozen) byId.set(article._id, article);
    for (const article of suggestion.data?.articles ?? []) {
      if (!byId.has(article._id)) byId.set(article._id, article);
    }
    // Picked first, in the order the reader picked them: that is the order the
    // email will list them in.
    const ordered: ICampaignArticlePick[] = [];

    for (const id of picked) {
      const found = byId.get(id);
      if (found) ordered.push(found);
    }

    const rest = Array.from(byId.values()).filter(
      (article) => !picked.includes(article._id),
    );

    return { selected: ordered, available: rest };
  }, [frozen, suggestion.data, picked]);

  const toggle = (id: string) => {
    setPicked((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : current.length >= MAX_ARTICLES
          ? current
          : [...current, id],
    );
  };

  const validate = () => {
    if (subject.trim().length < 3)
      return "A subject is the one line readers see in their inbox.";
    if (subject.trim().length > MAX_SUBJECT) return "The subject is too long.";
    if (heading.trim().length < 3)
      return "Give the issue a heading the email can open with.";
    if (heading.trim().length > MAX_HEADING) return "The heading is too long.";
    if (intro.trim().length > MAX_INTRO) return "The intro is too long.";
    if (preview.trim().length > MAX_PREVIEW)
      return "The preview line is too long for an inbox.";
    if (picked.length === 0) return "An issue needs at least one article.";
    return null;
  };

  const payload = (): TCampaignInput => ({
    subject: subject.trim(),
    preview: preview.trim(),
    heading: heading.trim(),
    intro: intro.trim(),
    articleIds: picked,
  });

  const save = (afterSave?: (id: string) => void) => {
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);

    if (draft) {
      update.mutate(
        { id: draft._id, payload: payload() },
        { onSuccess: () => afterSave?.(draft._id) },
      );
      return;
    }

    create.mutate(payload(), {
      onSuccess: (data) => {
        const saved = (data as { data?: ICampaign })?.data;
        if (saved?._id) afterSave?.(String(saved._id));
      },
    });
  };

  const openPreview = () => {
    // The preview endpoint renders a saved issue, so a new issue is saved
    // first. A draft's preview always reflects what is on disk, which is the
    // same copy a test send would use.
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setError(null);

    if (!draft) {
      create.mutate(payload(), {
        onSuccess: (data) => {
          const saved = (data as { data?: ICampaign })?.data;
          if (!saved?._id) return;
          onSaved(String(saved._id));
          previewMutation.mutate(String(saved._id), {
            onSuccess: () => setPreviewOpen(true),
          });
        },
      });
      return;
    }

    previewMutation.mutate(draft._id, {
      onSuccess: () => setPreviewOpen(true),
    });
  };

  const html = (previewMutation.data as { data?: { html?: string } })?.data
    ?.html;
  const text = (previewMutation.data as { data?: { text?: string } })?.data
    ?.text;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.015em]">
            {isDraft ? "Edit the draft" : "New issue"}
          </h2>
          <p className="mt-1 max-w-[60ch] text-sm leading-relaxed text-default-600">
            {isDraft
              ? "Nothing has gone out yet, so every field can still change."
              : "Pick the articles readers missed, then check a copy in your own inbox before anyone else gets one."}
          </p>
        </div>

        {onCancel && (
          <button type="button" onClick={onCancel} className={quietButton}>
            Back to the list
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Input
          label="Subject"
          labelPlacement="outside"
          placeholder="The one line in the inbox"
          value={subject}
          onValueChange={setSubject}
          maxLength={MAX_SUBJECT}
          isRequired
          isDisabled={isSaving}
          description={`${subject.length}/${MAX_SUBJECT}`}
        />
        <Input
          label="Preview line"
          labelPlacement="outside"
          placeholder="The grey line some inboxes show under the subject"
          value={preview}
          onValueChange={setPreview}
          maxLength={MAX_PREVIEW}
          isDisabled={isSaving}
          description={`${preview.length}/${MAX_PREVIEW}`}
        />
        <Input
          label="Heading"
          labelPlacement="outside"
          placeholder="October 2026"
          value={heading}
          onValueChange={setHeading}
          maxLength={MAX_HEADING}
          isRequired
          isDisabled={isSaving}
        />
        <Textarea
          label="Intro"
          labelPlacement="outside"
          placeholder="A short note before the articles. Two sentences is plenty."
          value={intro}
          onValueChange={setIntro}
          maxLength={MAX_INTRO}
          minRows={2}
          maxRows={6}
          isDisabled={isSaving}
          description="Shown under the heading, above the first article."
        />
      </div>

      <div className="rounded-[10px] border border-default/60">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-default/60 px-3.5 py-2.5">
          <p className="text-sm font-medium">
            Articles{" "}
            <span className="tabular-nums text-default-600">
              {picked.length}/{MAX_ARTICLES}
            </span>
          </p>
          {!isDraft && suggestion.data && (
            <p className="text-xs text-default-600">
              {suggestion.data.since
                ? `Published since the last issue went out`
                : "Every article, because this is the first issue"}
            </p>
          )}
        </div>

        {!isDraft && suggestion.isLoading ? (
          <ul
            className="divide-y divide-default/60"
            aria-busy="true"
            aria-hidden
          >
            {Array.from({ length: 5 }).map((_, index) => (
              <li key={index} className="px-3.5 py-3">
                <Skeleton className="h-4 w-3/4 rounded" />
              </li>
            ))}
          </ul>
        ) : (
          <div className="max-h-[26rem] overflow-y-auto">
            {choices.selected.length === 0 && choices.available.length === 0 ? (
              <p className="px-3.5 py-8 text-center text-sm text-default-600">
                No articles published yet. An issue can only carry what the site
                has.
              </p>
            ) : (
              <ol className="divide-y divide-default/60">
                {choices.selected.map((article, index) => (
                  <li key={article._id}>
                    <button
                      type="button"
                      onClick={() => toggle(article._id)}
                      aria-pressed="true"
                      className={`flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-default-50 ${focusRing}`}
                    >
                      <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-primary text-primary-foreground">
                        <FiCheck aria-hidden className="size-3" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="text-xs tabular-nums text-default-600">
                            {index + 1}.
                          </span>
                          <span className="min-w-0 truncate text-sm text-foreground">
                            {article.title}
                          </span>
                        </span>
                        {article.category && (
                          <span className="mt-0.5 block text-xs text-default-600">
                            {article.category}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}

                {choices.available.map((article) => (
                  <li key={article._id}>
                    <button
                      type="button"
                      onClick={() => toggle(article._id)}
                      aria-pressed="false"
                      disabled={picked.length >= MAX_ARTICLES}
                      className={`flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-default-50 disabled:opacity-50 ${focusRing}`}
                    >
                      <span
                        aria-hidden
                        className="mt-0.5 size-5 shrink-0 rounded-[4px] border border-default-300"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-default-700">
                          {article.title}
                        </span>
                        {article.category && (
                          <span className="mt-0.5 block text-xs text-default-600">
                            {article.category}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-default/60 pt-4">
        <button
          type="button"
          onClick={() => save()}
          disabled={isSaving}
          aria-busy={isSaving}
          className={primaryButton}
        >
          {isSaving
            ? "Saving…"
            : isDraft
              ? "Save the draft"
              : "Save as a draft"}
        </button>
        <button
          type="button"
          onClick={openPreview}
          disabled={isSaving || previewMutation.isPending}
          className={quietButton}
        >
          {previewMutation.isPending ? "Rendering…" : "Preview"}
        </button>
        <button
          type="button"
          onClick={() =>
            draft
              ? testMutation.mutate(draft._id)
              : save((id) => testMutation.mutate(id))
          }
          disabled={isSaving || testMutation.isPending}
          className={quietButton}
        >
          <FiMail aria-hidden className="size-4" />
          {testMutation.isPending ? "Sending…" : "Send me a test copy"}
        </button>
        <button
          type="button"
          onClick={() => save((id) => id && onRequestSend())}
          disabled={isSaving}
          className="ml-auto inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[6px] bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-500 disabled:opacity-60 sm:min-h-9"
        >
          {isDraft ? "Review and send" : "Save and send"}
        </button>
      </div>

      <Modal
        isOpen={previewOpen}
        onOpenChange={setPreviewOpen}
        size="4xl"
        radius="lg"
        scrollBehavior="outside"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-1 pb-1 pt-5">
            <span className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]">
              What readers will get
            </span>
            <span className="text-sm font-normal leading-relaxed text-default-600">
              Rendered from the saved copy. The opt-out link is switched off
              here; every real message carries its own.
            </span>
          </ModalHeader>
          <ModalBody>
            {html ? (
              <iframe
                title="Newsletter preview"
                srcDoc={html}
                sandbox=""
                className="h-[32rem] w-full rounded-[6px] border border-default/60 bg-white"
              />
            ) : (
              <p className="text-sm text-default-600">
                {text || "The preview did not render."}
              </p>
            )}
          </ModalBody>
          <ModalFooter>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className={quietButton}
            >
              <FiX aria-hidden className="size-4" />
              Close
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default CampaignEditor;
