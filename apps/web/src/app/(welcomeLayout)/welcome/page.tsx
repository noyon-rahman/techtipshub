import WelcomeStep from "@/components/modules/reader/welcome-step";
import { safeRedirectPath, welcomePath } from "@/lib/blog-routes";
import { readReaderSession } from "@/lib/reader-session";
import { redirect } from "next/navigation";

type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

const nextFrom = (raw?: string | string[]) =>
  safeRedirectPath((Array.isArray(raw) ? raw[0] : raw) ?? "/");

/**
 * `/welcome`: the one question a new member answers, once.
 *
 * Deliberately not under `/profile`, which `proxy.ts` gates on a session. Here
 * the page tells "signed out" from "not asked yet" itself, and only the first
 * of those needs a redirect: whether the reader has answered lives on the
 * account and is read by the screen's server action after load, so this page
 * carries no personal data in its render.
 *
 * The cookie is read, not `getSession`: this page is prerendered, and a
 * prerender that happens to find a session cookie renews it, which a page
 * render may not write back. The account's answer is the action's job anyway;
 * this only decides whether to ask.
 *
 * A signed-out visit goes to sign-in and comes straight back, so the URL can be
 * linked to without any special handling.
 */
const WelcomePage = async ({ searchParams }: Props) => {
  const { member } = await readReaderSession();
  const next = nextFrom((await searchParams).next);

  if (!member) {
    redirect(`/login?redirect=${encodeURIComponent(welcomePath)}`);
  }

  return <WelcomeStep next={next} />;
};

export default WelcomePage;
