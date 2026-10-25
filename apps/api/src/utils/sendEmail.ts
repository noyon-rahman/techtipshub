import nodemailer from "nodemailer";
import config, { isEmailConfigured } from "../config";

const transporter = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  secure: config.SMTP_PORT === 465,
  auth: {
    user: config.SMTP_AUTH_USER,
    pass: config.SMTP_AUTH_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

export { isEmailConfigured };

type TSendEmail = {
  to: {
    name: string;
    address: string;
  };
  subject: string;
  text: string;
  html: string;
  /**
   * When true, a failed send rejects instead of being logged and swallowed.
   * Legacy flows (password reset) rely on the old best-effort
   * behaviour, so this defaults to false.
   */
  throwOnError?: boolean;
};

const sendEmail = async ({
  to: { name, address },
  subject,
  text,
  html,
  throwOnError = false,
}: TSendEmail) => {
  try {
    await transporter.sendMail({
      from: {
        name: "TechTipsHub",
        address: config.NODEMAILER_EMAIL_FROM ?? "",
      },
      to: {
        name: name,
        address: address,
      },
      subject,
      text,
      html,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.log(error);
    // Re-throw so callers that must not claim a delivery (e.g. the contact
    // form) can report the failure instead of silently succeeding.
    if (throwOnError) throw error;
  }
};

export default sendEmail;
