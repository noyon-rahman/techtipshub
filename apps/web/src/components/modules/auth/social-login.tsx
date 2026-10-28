"use client";

import { Button } from "@heroui/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { safeRedirectPath } from "@/lib/blog-routes";

/**
 * Third-party sign-in, as a full-width labelled button so the option is
 * readable rather than a cryptic icon tile.
 *
 * The link goes to this site's own relay, which sends the browser to the API
 * and on to Google. The session comes back as cookies, so nothing here waits
 * for a response; the reader leaves the page instead.
 *
 * The reader's destination travels with them. Without it, someone sent here
 * from `/profile/blogs` by the proxy would sign in and land on the feed, losing
 * the page they were trying to reach.
 */
const GoogleSignIn = () => {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect");
  const [leaving, setLeaving] = useState(false);

  // Only a same-site path is ever forwarded, so a crafted `?redirect=` cannot
  // point Google's callback at another origin. The normaliser accepts the
  // slash-less `blogs/<slug>` form too, which is what the article's own links
  // use; without it, a reader who chose Google from an article lost it and
  // landed on the feed.
  const href = redirect
    ? `/api/auth/google?redirect=${encodeURIComponent(safeRedirectPath(redirect))}`
    : "/api/auth/google";

  // Coming back from Google in a browser that kept this page in its cache can
  // restore the button in its pressed state; a page shown again is a fresh try.
  useEffect(() => {
    const reset = () => setLeaving(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <div>
      <div className="flex items-center gap-3 tth-label-sm text-default-600">
        <span className="h-px flex-1 bg-default/60" aria-hidden />
        or
        <span className="h-px flex-1 bg-default/60" aria-hidden />
      </div>

      <div className="mt-5">
        <Button
          as="a"
          href={href}
          onClick={() => setLeaving(true)}
          isLoading={leaving}
          fullWidth
          radius="lg"
          variant="bordered"
          className="min-h-11 border border-default-300 font-medium text-foreground hover:bg-default-100"
          startContent={
            leaving ? undefined : <FcGoogle aria-hidden size={18} />
          }
        >
          {leaving ? "Opening Google…" : "Continue with Google"}
        </Button>
      </div>
    </div>
  );
};

const SocialLogin = () => (
  <Suspense fallback={<div className="h-24" />}>
    <GoogleSignIn />
  </Suspense>
);

export default SocialLogin;
