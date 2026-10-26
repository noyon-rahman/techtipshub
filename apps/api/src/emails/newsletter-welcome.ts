import config from "../config";
import { escapeHtml, renderEmail, type TEmailMessage } from "./layout";

export type TWelcomeEmailArgs = {
  name: string;
  unsubscribeUrl: string;
};

/**
 * Sent the moment someone joins the list. It is a receipt, not a pitch: it
 * says what they will get, how often, and how to leave, and nothing else.
 */
export const newsletterWelcomeMessage = async ({
  name,
  unsubscribeUrl,
}: TWelcomeEmailArgs): Promise<TEmailMessage> => {
  const subject = "You're on the TechTipsHub list";
  const site = config.CLIENT_BASE_URL.replace(/\/$/, "");

  const html = await renderEmail({
    title: subject,
    preview: "One roundup a month, and nothing else.",
    heading: `You're on the list, ${name}.`,
    content: `
      <mj-text>Thanks for joining. Once a month we send one email with the articles worth your time from TechTipsHub: tutorials, explainers and tool notes, with a short reason for each.</mj-text>
      <mj-text>No daily mail, no selling your address, and nothing from anyone else. If a month is quiet, you will not hear from us at all.</mj-text>
      <mj-button href="${escapeHtml(site)}/">Read the latest articles</mj-button>
      <mj-text padding="8px 0 8px 0">Reply to this email if you have a question about how the list works. A person reads it.</mj-text>
    `,
    footerNote:
      "You joined the TechTipsHub newsletter from the site or from your profile.",
    unsubscribeUrl,
  });

  const text = [
    `Hi ${name},`,
    "",
    "Thanks for joining the TechTipsHub list.",
    "",
    "Once a month we send one email with the articles worth your time, each with a short reason. If a month is quiet, you will not hear from us at all.",
    "",
    `Latest articles: ${site}/`,
    "",
    "Reply to this email if you have a question about how the list works.",
    "",
    `Unsubscribe: ${unsubscribeUrl}`,
    "",
    `You joined from the site or from your profile using ${name ? "your name and this address" : "this address"}. Never forwarded to anyone else.`,
  ].join("\n");

  return { subject, html, text };
};