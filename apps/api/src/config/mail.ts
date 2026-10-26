import env from "./env";

export const MAIL_DOMAIN = env.MAIL_DOMAIN;

const sender = (localPart: string, name: string) => ({
  name,
  address: `${localPart}@${MAIL_DOMAIN}`,
});

/**
 * The addresses we send as. Resend verifies the domain, not each address, so
 * every local part below is available once `techtipshub.noyonrahman.com` is
 * verified. The local part tells the reader who the mail is from: sign-in and
 * account mail from `security`, support replies from `support`.
 */
export const MAIL_SENDERS = {
  hello: sender("hello", "TechTipsHub"),
  support: sender("support", "TechTipsHub Support"),
  security: sender("security", "TechTipsHub Security"),
  notifications: sender("notifications", "TechTipsHub"),
  newsletter: sender("newsletter", "TechTipsHub"),
} as const;

/**
 * The address the monthly roundup comes from. It differs from the
 * transactional senders because a reader should be able to filter campaigns
 * apart from account mail, and because a reply here goes to a person.
 */
export const NEWSLETTER_SENDER: TMailSenderKey = "newsletter";

export type TMailSenderKey = keyof typeof MAIL_SENDERS;

/**
 * Replies land in a mailbox someone reads. A no-reply sender is what makes a
 * transactional mail a dead end, so every send gets a reply address unless it
 * names its own (the contact form replies to the visitor).
 */
export const MAIL_REPLY_TO = env.MAIL_REPLY_TO ?? `hello@${MAIL_DOMAIN}`;

/** Contact-form submissions, and the address the templates show. */
export const CONTACT_INBOX = env.CONTACT_INBOX ?? `hello@${MAIL_DOMAIN}`;
