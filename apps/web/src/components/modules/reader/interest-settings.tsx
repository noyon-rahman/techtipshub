"use client";

import InterestPicker from "@/components/modules/reader/interest-picker";
import { readInterestsAction, saveInterestsAction } from "@/services/reader/actions";
import { useEffect, useState } from "react";

/**
 * The reader's topics, on the profile.
 *
 * The same choice the interests step asks for, kept where it can be changed
 * later. It reads the saved list after load, like the newsletter switch, so the
 * page around it is not a per-request render.
 *
 * Saving is explicit rather than on every tick: a reader can change several
 * topics before committing, and the button says how many are waiting.
 */
const InterestSettings = () => {
  const [saved, setSaved] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [answered, setAnswered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    readInterestsAction()
      .then((result) => {
        if (cancelled) return;

        if (result.success && result.data) {
          setSaved(result.data.interests);
          setSelected(result.data.interests);
          setAnswered(result.data.answered);
        } else if (!result.success) {
          setError(result.message || "Your topics did not load.");
        }

        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError("Your topics did not load.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const changed =
    selected.length !== saved.length ||
    selected.some((id) => !saved.includes(id));

  const save = async () => {
    setSaving(true);
    setError(null);

    const result = await saveInterestsAction(selected);

    setSaving(false);

    if (!result.success) {
      setError(result.message || "Your topics were not saved.");
      return;
    }

    setSaved(result.data?.interests ?? selected);
    setAnswered(result.data?.answered ?? true);
  };

  return (
    <div>
      <p className="mb-4 text-sm leading-relaxed text-default-600">
        {answered && saved.length === 0
          ? "No topics picked. The feed shows everything; pick a few and they lead."
          : "The feed puts new writing about these topics at the top."}
      </p>

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-11 animate-pulse rounded-[6px] bg-default-100"
            />
          ))}
          <p className="sr-only" role="status">
            Loading your topics
          </p>
        </div>
      ) : (
        <InterestPicker
          selected={selected}
          onChange={setSelected}
          disabled={saving}
          label="Your topics"
        />
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!changed || saving || loading}
          className="inline-flex min-h-11 items-center rounded-[6px] bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:min-h-9"
        >
          {saving ? "Saving…" : "Save topics"}
        </button>
        {changed && !saving && (
          <span className="text-xs text-default-600">Unsaved changes</span>
        )}
      </div>
    </div>
  );
};

export default InterestSettings;
