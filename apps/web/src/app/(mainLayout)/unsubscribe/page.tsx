import UnsubscribeButton from "@/components/modules/newsletter/unsubscribe-button";
import Container from "@/components/ui/container";
import { readUnsubscribeAction } from "@/services/newsletter/actions";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Unsubscribe",
  description: "Leave the TechTipsHub newsletter.",
  alternates: { canonical: "/unsubscribe" },
  robots: { index: false, follow: false },
};

/**
 * The page every campaign and welcome mail links to.
 *
 * The address and token arrive in the query. The token is checked by signature
 * before the page says whose address it is or removes anything, so a guessed
 * address cannot be used to take someone off the list.
 */
const UnsubscribePage = async ({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; token?: string }>;
}) => {
  const { email, token } = await searchParams;

  const check =
    email && token
      ? await readUnsubscribeAction({ email, token })
      : {
          valid: false as const,
          message:
            "This link is incomplete. Use the unsubscribe link at the foot of any edition.",
        };

  return (
    <Container>
      <section className="mx-auto max-w-read py-16 lg:py-24">
        <p className="tth-label">The newsletter</p>

        <h1 className="mt-3 font-[family-name:var(--type-editorial)] text-3xl font-semibold leading-[1.15] tracking-[-0.015em] text-balance md:text-4xl">
          {check.valid ? "Leaving the list" : "This link did not work"}
        </h1>

        {check.valid ? (
          <>
            <p className="mt-4 leading-relaxed text-default-700">
              You asked to stop getting the monthly roundup at{" "}
              <strong className="font-semibold text-foreground">
                {check.address}
              </strong>
              .
            </p>

            <UnsubscribeButton email={check.address} token={token!} />

            <p className="mt-8 text-sm leading-relaxed text-default-600">
              Changed your mind? You can join again from{" "}
              <Link
                href="/"
                className="text-primary-accessible underline-offset-4 hover:underline"
              >
                any page of the site
              </Link>
              . New articles are still free to read.
            </p>
          </>
        ) : (
          <>
            <p className="mt-4 leading-relaxed text-default-700">
              {check.message}
            </p>
            <p className="mt-8 text-sm leading-relaxed text-default-600">
              You can also reply to any edition and ask us to remove you, or
              write to our contact address. Both reach a person.
            </p>
            <p className="mt-4">
              <Link
                href="/contact"
                className="text-sm font-medium text-primary-accessible underline-offset-4 hover:underline"
              >
                Contact us
              </Link>
            </p>
          </>
        )}
      </section>
    </Container>
  );
};

export default UnsubscribePage;
