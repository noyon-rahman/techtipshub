import {
  brand,
  escapeHtml,
  renderEmail,
  textFont,
  type TEmailMessage,
} from "./layout";

export type TContactNotificationArgs = {
  firstName: string;
  fullName: string;
  email: string;
  subject: string;
  message: string;
};

export const contactNotificationMessage = async ({
  firstName,
  fullName,
  email,
  subject,
  message,
}: TContactNotificationArgs): Promise<TEmailMessage> => {
  const mailSubject = `[Contact] ${subject}`;
  const name = escapeHtml(fullName);
  const address = escapeHtml(email);
  const line = escapeHtml(subject);
  const body = escapeHtml(message);
  const shortName = escapeHtml(firstName);

  const replyUrl = escapeHtml(
    `mailto:${email}?subject=${encodeURIComponent(`Re: ${subject}`)}`,
  );

  const html = await renderEmail({
    title: mailSubject,
    preview: `New message from ${fullName}.`,
    heading: "New contact message",
    footerNote: "This message came through the TechTipsHub contact form.",
    showContact: false,
    content: `
      <mj-text>A visitor sent this through the TechTipsHub contact form.</mj-text>
      <mj-table cellpadding="0" cellspacing="0" role="presentation" width="100%" padding="0" font-family="${textFont}" font-size="15px" line-height="1.5" color="${brand.ink}">
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${brand.hairline};width:84px;vertical-align:top;font-size:13px;color:${brand.muted};">From</td>
          <td style="padding:10px 0;border-bottom:1px solid ${brand.hairline};vertical-align:top;word-break:break-word;">${name} &lt;<a href="mailto:${address}" style="color:${brand.amberText};text-decoration:underline;">${address}</a>&gt;</td>
        </tr>
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${brand.hairline};width:84px;vertical-align:top;font-size:13px;color:${brand.muted};">Subject</td>
          <td style="padding:10px 0;border-bottom:1px solid ${brand.hairline};vertical-align:top;word-break:break-word;">${line}</td>
        </tr>
      </mj-table>
      <mj-text padding="0 0 16px 0">
        <div style="background-color:${brand.surface};border-radius:6px;padding:16px 18px;white-space:pre-wrap;font-size:16px;line-height:1.6;color:${brand.ink};">${body}</div>
      </mj-text>
      <mj-text>Reply to this email and your answer goes to ${name} at ${address}.</mj-text>
      <mj-button href="${replyUrl}">Reply to ${shortName}</mj-button>
    `,
  });

  const text = [
    "New contact message",
    "",
    `From: ${fullName} <${email}>`,
    `Subject: ${subject}`,
    "",
    message,
    "",
    `Reply to this email and your answer goes to ${fullName} at ${email}.`,
  ].join("\n");

  return { subject: mailSubject, html, text };
};
