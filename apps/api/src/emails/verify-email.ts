import { brand, escapeHtml, renderEmail, type TEmailMessage } from "./layout";

export type TVerifyEmailArgs = {
  fullName: string;
  verifyUrl: string;
  expiresIn: string;
};

export const verifyEmailMessage = async ({
  fullName,
  verifyUrl,
  expiresIn,
}: TVerifyEmailArgs): Promise<TEmailMessage> => {
  const subject = "Verify your email address";
  const name = escapeHtml(fullName);
  const url = escapeHtml(verifyUrl);
  const expiry = escapeHtml(expiresIn);

  const html = await renderEmail({
    title: subject,
    preview:
      "Confirm your address to finish setting up your TechTipsHub account.",
    heading: "Verify your email address",
    content: `
      <mj-text>Hi ${name},</mj-text>
      <mj-text>Confirm this address to finish setting up your TechTipsHub account. It takes one click.</mj-text>
      <mj-button href="${url}">Verify email address</mj-button>
      <mj-text font-size="13px" line-height="1.6" color="${brand.muted}">This link expires in ${expiry}. If you did not create an account, you can ignore this email.</mj-text>
      <mj-text padding="8px 0 8px 0">If the button does not work, paste this link into your browser:</mj-text>
      <mj-text font-size="13px" line-height="1.6" color="${brand.amberText}"><a href="${url}" style="color:${brand.amberText};text-decoration:underline;word-break:break-all;">${url}</a></mj-text>
    `,
  });

  const text = [
    `Hi ${fullName},`,
    "",
    "Confirm this address to finish setting up your TechTipsHub account:",
    verifyUrl,
    "",
    `This link expires in ${expiresIn}. If you did not create an account, you can ignore this email.`,
  ].join("\n");

  return { subject, html, text };
};
