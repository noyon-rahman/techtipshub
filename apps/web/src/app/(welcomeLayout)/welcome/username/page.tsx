import UsernameStep from "@/components/modules/reader/username-step";
import {
  safeRedirectPath,
  usernameOnboardingPath,
} from "@/lib/blog-routes";
import { redirect } from "next/navigation";
type Props = {
  searchParams: Promise<{ next?: string | string[] }>;
};

const nextFrom = (raw?: string | string[]) =>
  safeRedirectPath((Array.isArray(raw) ? raw[0] : raw) ?? "/");

/**
 * `/welcome/username`: the handle a new member is addressed by, asked once.
 *
 * The first of the two welcome steps, because the handle is what every link to
 * the member will say. It sits under `/welcome`, which `proxy.ts` protects, so a
 * signed-out visit goes to sign-in and comes straight back. The page itself
 * carries no personal data: the suggestion, and whether the step still applies,
 * are read by the screen's server action after load, so the document stays
 * prerendered and shared.
 */
const UsernameOnboardingPage = async ({ searchParams }: Props) => {
  const next = nextFrom((await searchParams).next);

  // A member who reaches this page with itself as the destination would be sent
  // back here after finishing; the feed is the honest fallback.
  if (next === usernameOnboardingPath) redirect("/");

  return <UsernameStep next={next} />;
};

export default UsernameOnboardingPage;
