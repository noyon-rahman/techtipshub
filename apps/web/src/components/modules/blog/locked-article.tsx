import ButtonLink from "@/components/ui/button-link";
import { FcGoogle } from "react-icons/fc";

/**
 * Where a guest's reading stops.
 *
 * The preview above this is several paragraphs of the real article. Its last
 * lines fade into the page colour — the text runs out rather than being cut —
 * and then a gap, and then the ask.
 *
 * The ask is centred and has no surface of its own. Nothing here is a card: it
 * is the article ending and one decision following it. A box would make it a
 * component sitting in the page; leaving it open makes it the end of the page.
 *
 * The order is fastest path first. Google completes in one redirect, so it is
 * the primary button; email signup and email login follow in the same stack
 * with the same weight, because a reader who does not want to hand over a
 * Google account should not have to hunt for the alternative.
 *
 * Every option carries `redirectPath`, which is how the reader comes back to
 * this article rather than the feed. The page around it is prerendered and
 * cached, so it is the same document for a guest and a member: it cannot read
 * the session to build these links, and does not need to — `ArticleAccess`
 * shows the body once the reader is back with a session.
 *
 * Only options the site actually offers appear here. There is no Facebook
 * button because there is no Facebook sign-in.
 */
interface IProps {
  /** This article's path, without a leading slash (`blogs/<slug>`). */
  redirectPath: string;
  loginHref: string;
}

const LockedArticle = ({ redirectPath, loginHref }: IProps) => {
  const googleHref = `/api/auth/google?redirect=${encodeURIComponent(
    `/${redirectPath}`,
  )}`;
  const signupHref = `/signup?redirect=${encodeURIComponent(redirectPath)}`;

  return (
    <section
      aria-label="Create an account to read the full article"
      className="relative"
    >
      {/* The gap is part of the effect: the reader meets empty space where the
          next paragraph should have been before they meet the ask. */}
      <div className="h-16 sm:h-20" aria-hidden />

      <div className="mx-auto max-w-lg text-center">
        <h2
          id="locked-article"
          className="font-[family-name:var(--type-editorial)] text-[1.65rem] font-semibold leading-[1.22] tracking-[-0.015em] text-balance sm:text-[1.95rem]"
        >
          Create an account to read the full article.
        </h2>

        <p className="mx-auto mt-4 max-w-[44ch] text-[0.9rem] leading-relaxed text-default-600">
          The author made this article available to TechTipsHub members. It takes
          a moment to join, and you can read everything on the site.
        </p>

        <div className="mx-auto mt-9 flex max-w-sm flex-col items-stretch gap-2.5">
          <ButtonLink
            href={googleHref}
            variant="bordered"
            className="min-h-11 w-full rounded-full border border-default-300 px-6 font-medium text-foreground hover:bg-default-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
          >
            <FcGoogle aria-hidden size={18} className="shrink-0" />
            Continue with Google
          </ButtonLink>

          <ButtonLink
            href={signupHref}
            color="primary"
            className="min-h-11 w-full rounded-full px-6 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
          >
            Sign up with email
          </ButtonLink>
        </div>

        <p className="mt-6 text-[0.85rem] leading-relaxed text-default-600">
          Already have an account?{" "}
          <a
            href={loginHref}
            className="font-medium text-primary-700 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
          >
            Sign in
          </a>
        </p>
      </div>
    </section>
  );
};

export default LockedArticle;
