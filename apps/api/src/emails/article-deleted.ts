import { CONTACT_INBOX } from "../config/mail";
import { brand, escapeHtml, renderEmail, type TEmailMessage } from "./layout";

export type TArticleDeletedEmailArgs = {
  fullName: string;
  articleTitle: string;
  reason: string;
};

export const articleDeletedEmailMessage = async ({
  fullName,
  articleTitle,
  reason,
}: TArticleDeletedEmailArgs): Promise<TEmailMessage> => {
  const subject = "Your article was removed from TechTipsHub";
  const name = escapeHtml(fullName);
  const title = escapeHtml(articleTitle);
  const removalReason = escapeHtml(reason);

  const replyUrl = escapeHtml(
    `mailto:${CONTACT_INBOX}?subject=${encodeURIComponent(
      `Re: ${articleTitle}`,
    )}`,
  );

  const html = await renderEmail({
    title: subject,
    preview: `The article "${articleTitle}" is no longer published.`,
    heading: "Your article was removed",
    footerNote:
      "You received this email because you wrote this article for TechTipsHub.",
    showContact: false,
    content: `
      <mj-text>Hi ${name},</mj-text>
      <mj-text>The article "${title}" is no longer published on TechTipsHub.</mj-text>
      <mj-text padding="0 0 16px 0">
        <div style="background-color:${brand.surface};border-radius:6px;padding:16px 18px;">
          <span style="display:block;font-size:13px;line-height:1.5;color:${brand.muted};">Reason</span>
          <span style="display:block;padding-top:4px;font-size:16px;line-height:1.6;color:${brand.ink};">${removalReason}</span>
        </div>
      </mj-text>
      <mj-text>If you think this was a mistake, reply to this email and we will take a look.</mj-text>
      <mj-button href="${replyUrl}">Email the team</mj-button>
    `,
  });

  const text = [
    `Hi ${fullName},`,
    "",
    `The article "${articleTitle}" is no longer published on TechTipsHub.`,
    "",
    `Reason: ${reason}`,
    "",
    "If you think this was a mistake, reply to this email and we will take a look.",
  ].join("\n");

  return { subject, html, text };
};
