import { AdSlot } from "@/components/adsense";
import FactList, { Fact, FactLink } from "@/components/editorial/fact-list";
import PageHero from "@/components/editorial/page-hero";
import ContactForm from "@/components/modules/contact/contact-form";
import NewsletterSignup from "@/components/modules/newsletter/newsletter-signup";
import ButtonLink from "@/components/ui/button-link";
import Container from "@/components/ui/container";
import { legalConfig } from "@/config/legal";
import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with TechTipsHub about feedback, corrections, writing, or advertising.",
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact TechTipsHub",
    description:
      "Get in touch with TechTipsHub about feedback, corrections, writing, or advertising.",
    url: "/contact",
  },
};

// Real inbox the contact endpoint delivers to (CONTACT_INBOX, falling back to
// the configured sending address). Override with NEXT_PUBLIC_CONTACT_EMAIL.
const CONTACT_EMAIL = legalConfig.contactEmail;

const reasons = [
  {
    title: "Feedback and corrections",
    body: "Spotted an error in an article? Send the URL and what is wrong. Corrections are made on the page itself.",
  },
  {
    title: "Write with us",
    body: "Pitch a tutorial or explainer. A short outline and a link to something you have written is enough.",
  },
  {
    title: "Advertising",
    body: "Sponsored placements are labelled as advertising. Ask for the current options and rates.",
  },
  {
    title: "Account problems",
    body: "Locked out, or need a profile removed? Write from the address on the account so we can verify it.",
  },
];

const Contact = () => {
  return (
    <div>
      {/* Hero */}
      <section className="border-b border-default/60 bg-content-1/50">
        <Container>
          <div className="py-10 sm:py-14 lg:py-20">
            <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_21rem] lg:gap-14">
              <PageHero
                eyebrow="Contact"
                title={
                  <>
                    Write to the people who{" "}
                    <span className="text-primary-accessible">
                      publish here
                    </span>
                  </>
                }
                lede="Corrections, pitches and account questions all reach the same inbox. A real person reads every message, usually within a couple of business days."
                meta={
                  <div className="flex flex-wrap items-center gap-3">
                    <ButtonLink
                      href="#contact-form"
                      radius="md"
                      color="primary"
                      className="font-semibold"
                    >
                      Send a message
                    </ButtonLink>
                    <ButtonLink
                      href={`mailto:${CONTACT_EMAIL}`}
                      radius="md"
                      variant="bordered"
                    >
                      Email instead
                    </ButtonLink>
                  </div>
                }
              />

              <aside className="rounded-[10px] border border-default/70 border-t-2 border-t-primary bg-content-1 p-5 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-6">
                <h2 className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.01em]">
                  Where to write
                </h2>
                <p className="mt-1 text-xs text-default-600">
                  Direct editorial and support inbox.
                </p>
                <FactList label="Contact details" className="mt-4 border-b-0">
                  <FactLink term="Email" href={`mailto:${CONTACT_EMAIL}`}>
                    {CONTACT_EMAIL}
                  </FactLink>
                  <Fact term="Form">
                    <Link
                      href="#contact-form"
                      className="text-primary-accessible underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      On this page
                    </Link>
                  </Fact>
                  <Fact term="Reply time">A couple of business days</Fact>
                </FactList>
              </aside>
            </div>
          </div>
        </Container>
      </section>

      <Container>
        {/* Main workspace: Form on the left, routing guide on the right */}
        <section
          aria-labelledby="contact-form"
          className="scroll-mt-24 border-b border-default/60 py-12 sm:py-16"
        >
          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-10">
            <div className="rounded-[10px] border border-default/70 bg-content-1 p-5 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-7">
              <div className="mb-6 border-b border-default/60 pb-4">
                <h2
                  id="contact-form"
                  className="font-[family-name:var(--type-editorial)] text-2xl font-semibold tracking-[-0.015em]"
                >
                  Send a message
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-default-600">
                  Every field is required. Replies go to the email address you
                  enter.
                </p>
              </div>
              <ContactForm />
            </div>

            <div className="space-y-4">
              <div className="px-1">
                <h2 id="reasons" className="tth-label">
                  What reaches us
                </h2>
                <p className="mt-1.5 text-sm leading-relaxed text-default-600">
                  Include one of these in the subject so your note reaches the
                  right person sooner.
                </p>
              </div>

              <ol className="space-y-3">
                {reasons.map((reason, index) => (
                  <li
                    key={reason.title}
                    className="rounded-[10px] border border-default/70 bg-content-1 p-4 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none"
                  >
                    <div className="flex items-baseline gap-2.5">
                      <span className="inline-flex rounded-[6px] bg-primary/12 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary-accessible">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h3 className="font-[family-name:var(--type-editorial)] text-base font-semibold tracking-[-0.01em]">
                        {reason.title}
                      </h3>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-default-600">
                      {reason.body}
                    </p>
                  </li>
                ))}
              </ol>

              <p className="px-1 pt-1 text-xs leading-relaxed text-default-600">
                Before writing, check the{" "}
                <Link
                  href="/community-guidelines"
                  className="font-medium text-primary-accessible underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  community guidelines
                </Link>{" "}
                or browse{" "}
                <Link
                  href="/"
                  className="font-medium text-primary-accessible underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  published articles
                </Link>
                .
              </p>
            </div>
          </div>
        </section>

        <div className="pt-4">
          <AdSlot variant="display" placement="contact-form-end" />
        </div>

        {/* Newsletter card */}
        <section
          aria-labelledby="newsletter"
          className="border-b border-default/60 py-12"
        >
          <div className="grid items-center gap-6 rounded-[10px] border border-default/70 bg-content-1 p-5 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12">
            <div>
              <h2
                id="newsletter"
                className="font-[family-name:var(--type-editorial)] text-xl font-semibold tracking-[-0.01em]"
              >
                The monthly roundup
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-default-600">
                Nothing to ask right now? Get the monthly roundup instead, and
                write to us when something comes up.
              </p>
            </div>
            <NewsletterSignup layout="stack" className="max-w-xl" />
          </div>
        </section>

        {/* Closing invitation banner */}
        <section className="py-12 sm:py-16">
          <div className="flex flex-col justify-between gap-6 rounded-[10px] border border-default/70 bg-content-1 p-6 shadow-[0_1px_2px_rgba(20,19,21,0.04)] dark:shadow-none sm:p-8 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="font-[family-name:var(--type-editorial)] text-pretty text-2xl font-semibold tracking-[-0.015em] md:text-[1.75rem]">
                Want to write here instead?
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-default-600 sm:text-base">
                Publishing is open to anyone with an account. The About page
                explains what we publish and the standards every article meets.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <ButtonLink href="/signup" radius="md" color="primary">
                Create a free account
              </ButtonLink>
              <ButtonLink href="/about" radius="md" variant="bordered">
                About the publication
              </ButtonLink>
            </div>
          </div>
        </section>
      </Container>
    </div>
  );
};

export default Contact;
