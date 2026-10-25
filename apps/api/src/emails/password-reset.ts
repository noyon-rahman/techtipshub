import { brand, escapeHtml, renderEmail, type TEmailMessage } from "./layout";

export type TPasswordResetEmailArgs = {
  fullName: string;
  resetUrl: string;
  expiresIn: string;
};

export const passwordResetEmailMessage = async ({
  fullName,
  resetUrl,
  expiresIn,
}: TPasswordResetEmailArgs): Promise<TEmailMessage> => {
  const subject = "Reset your TechTipsHub password";
  const name = escapeHtml(fullName);
  const url = escapeHtml(resetUrl);
  const expiry = escapeHtml(expiresIn);

  const html = await renderEmail({
    title: subject,
    preview: "Use the link in this email to choose a new password.",
    heading: "Reset your password",
    content: `
      <mj-text>Hi ${name},</mj-text>
      <mj-text>We received a request to reset the password for this address. Choose a new password below.</mj-text>
      <mj-button href="${url}">Choose a new password</mj-button>
      <mj-text font-size="13px" line-height="1.6" color="${brand.muted}">This link expires in ${expiry}. If you did not ask for this, you can ignore this email. Your password has not changed.</mj-text>
      <mj-text padding="8px 0 8px 0">If the button does not work, paste this link into your browser:</mj-text>
      <mj-text font-size="13px" line-height="1.6" color="${brand.amberText}"><a href="${url}" style="color:${brand.amberText};text-decoration:underline;word-break:break-all;">${url}</a></mj-text>
    `,
  });

  const text = [
    `Hi ${fullName},`,
    "",
    "We received a request to reset the password for this address.",
    "Choose a new password here:",
    resetUrl,
    "",
    `This link expires in ${expiresIn}. If you did not ask for this, you can ignore this email. Your password has not changed.`,
  ].join("\n");

  return { subject, html, text };
};
