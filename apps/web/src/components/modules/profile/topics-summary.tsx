"use client";

import { readInterestsAction } from "@/services/reader/actions";
import { settingsButton } from "@/components/modules/profile/profile-edit-form";
import { useEffect, useState } from "react";

interface IProps {
  /** Called once the editor holds the picker, so the page can bring it into view. */
  onEdit: () => void;
}

/**
 * The reader's topics, as part of the profile rather than part of its form.
 *
 * The profile page shows who a member is; this states what their feed leads
 * with, and "Change topics" opens the editor on the picker. Read after load,
 * like the newsletter switch, so the page around it stays a server render.
 *
 * Nothing is shown while the answer is on its way, and nothing is shown if it
 * does not arrive: an empty band is quieter than a band that says a member
 * picked nothing when the request simply failed.
 */
const TopicsSummary = ({ onEdit }: IProps) => {
  const [names, setNames] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    readInterestsAction()
      .then((result) => {
        if (cancelled) return;

        if (result.success && result.data) {
          setNames(result.data.names);
        }
      })
      .catch(() => {
        // Left empty; the editor is still one click away.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!names) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-4">
      <div className="min-w-0">
        <p className="tth-label">Your topics</p>

        {names.length > 0 ? (
          <ul
            className="mt-1.5 flex flex-wrap gap-1.5"
            aria-label="Your topics"
          >
            {names.map((name) => (
              <li
                key={name}
                className="rounded-full border border-default-300 px-2.5 py-0.5 text-sm text-foreground"
              >
                {name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-default-600">
            None picked. The feed shows everything.
          </p>
        )}
      </div>

      <button type="button" onClick={onEdit} className={settingsButton}>
        Change topics
      </button>
    </div>
  );
};

export default TopicsSummary;
