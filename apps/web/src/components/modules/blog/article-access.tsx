"use client";

import { resolveArticleAccess } from "@/services/blog/article-access";
import { useEffect, useState } from "react";

const READY_EVENT = "tth:article-access";

export type ArticleAccessState = "member" | "guest";

/**
 * Which half of a prerendered article is visible.
 *
 * The document is cached and served to everyone, so it carries both halves: the
 * preview with the members prompt, and the member body. This component decides
 * which one is on screen, from the answer the server action gives for the
 * request that is actually reading it.
 *
 * Until that answer lands neither half is shown. The prompt is the conservative
 * default for a document nobody has asked about - CSS shows it when scripting
 * never runs - but it is the wrong thing to show a member, and it was being
 * shown to every member on every cold load for the length of the round trip.
 *
 * The check itself is two cookie reads: one for the session, one for whether
 * this is a browser at all. Counting the view is not part of this answer and
 * does not happen here; `BlogViewCounter` records it from the browser.
 *
 * The visible half is keyed on `data-article-view` on the article container
 * (see the article access rules in `globals.css`), never by re-rendering the
 * body.
 */
const ArticleAccess = () => {
  const [state, setState] = useState<ArticleAccessState>("guest");

  useEffect(() => {
    const container = document.querySelector<HTMLElement>(
      "[data-article-access]",
    );
    if (!container) return;

    // Before the answer arrives neither column is shown. The prompt is the safe
    // default for a document nobody has asked about, but showing it to a member
    // and then swapping it for the body is exactly the flash being fixed: the
    // header and byline stay, and the body area opens when the check answers.
    container.setAttribute("data-article-waiting", "");

    // Once the body is shown it stays: the reader has been given it, and a
    // later answer must not take it away and restore the prompt.
    let shown: ArticleAccessState | undefined;

    const setView = (answer: ArticleAccessState) => {
      if (shown === "member") return;
      if (shown === answer) return;

      shown = answer;
      container.removeAttribute("data-article-waiting");
      container.setAttribute("data-article-view", answer);
      setState(answer);
      window.dispatchEvent(
        new CustomEvent<ArticleAccessState>(READY_EVENT, { detail: answer }),
      );
    };

    // The check restarts with every effect run, including the second one React
    // makes on mount in development, so an abandoned run can never leave the
    // page waiting. The answer is a cookie read and costs nothing to repeat.
    resolveArticleAccess()
      .then(({ canRead }) => setView(canRead ? "member" : "guest"))
      // The check never answered: the prompt, never the body.
      .catch(() => setView("guest"));
  }, []);

  return <span hidden aria-hidden data-article-access-for={state} />;
};

/**
 * React to the reader's answer, for the parts of the page that only make sense
 * inside the member body (the in-article ad).
 *
 * Returns `false` until the answer is "member", so nothing is requested for a
 * guest, and `true` afterwards.
 */
export const useCanReadArticle = () => {
  const [canRead, setCanRead] = useState(false);

  useEffect(() => {
    const onReady = (event: Event) => {
      setCanRead(
        (event as CustomEvent<ArticleAccessState>).detail === "member",
      );
    };

    window.addEventListener(READY_EVENT, onReady);
    return () => window.removeEventListener(READY_EVENT, onReady);
  }, []);

  return canRead;
};

export default ArticleAccess;
