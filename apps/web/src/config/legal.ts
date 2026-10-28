/**
 * Single source of truth for the public legal documents.
 *
 * Everything here is shown to visitors, so update the `lastUpdated` pair
 * whenever a policy changes materially. `lastUpdated` is the machine-readable
 * value used by `<time dateTime="…">`; `lastUpdatedLabel` is what readers see.
 *
 * The operator is a person, not a company: TechTipsHub is published by Novon
 * Rahman as an individual. There is no registered company name and no business
 * address, so the pages name the person and give the contact address as the
 * address of record. Restoring a company name or a street address means
 * updating `legalEntity`, `legalAddress` and `legalAddressLabel` together.
 */
export const legalConfig = {
  operator: "TechTipsHub",
  siteUrl: "https://techtipshub.vercel.app",
  contactEmail:
    process.env.NEXT_PUBLIC_CONTACT_EMAIL ||
    "contact.techtipshub@noyonrahman.com",
  /** The person who publishes the site. Named on every policy. */
  legalEntity: "Novon Rahman, publishing as TechTipsHub",
  /** How the entity is described on the pages. */
  legalEntityLabel: "Published by",
  /**
   * No registered office exists, so this is the contact address rather than a
   * postal one. The label says "Address" so nothing claims to be registered.
   */
  legalAddress: "contact.techtipshub@noyonrahman.com",
  legalAddressLabel: "Address",
  lastUpdated: "2026-10-27",
  lastUpdatedLabel: "27 October 2026",
  /** Minimum age for an account, in years. */
  minimumAge: 13,
  governingLaw: "the laws of the People's Republic of Bangladesh",
} as const;

export interface ILegalPageLink {
  label: string;
  href: string;
  title: string;
  description: string;
}

/**
 * Order matters: it drives the footer columns, the cross-links at the end of
 * each document, and the "all policies" navigation.
 */
export const legalPages: ILegalPageLink[] = [
  {
    label: "Privacy Policy",
    href: "/privacy",
    title: "Privacy Policy",
    description:
      "What we collect, why we collect it, and the choices you have over your data.",
  },
  {
    label: "Terms and Conditions",
    href: "/terms",
    title: "Terms and Conditions",
    description:
      "The rules for using TechTipsHub, publishing content and commenting.",
  },
  {
    label: "Cookie Policy",
    href: "/cookie",
    title: "Cookie Policy",
    description:
      "The cookies and similar technologies this site uses, and how to control them.",
  },
  {
    label: "Refund Policy",
    href: "/refund-policy",
    title: "Refund and Cancellation Policy",
    description:
      "How accidental donations and payments are reviewed and refunded. Nothing on the site requires payment.",
  },
  {
    label: "Disclaimer",
    href: "/disclaimer",
    title: "Disclaimer",
    description:
      "The limits of the technical advice, code samples and advertising we publish.",
  },
  {
    label: "Community Guidelines",
    href: "/community-guidelines",
    title: "Community Guidelines",
    description:
      "What is welcome in blogs and comments, and how moderation works.",
  },
];
