import mjml2html from "mjml";
import { CONTACT_INBOX } from "../config/mail";

export type TEmailMessage = {
  subject: string;
  html: string;
  text: string;
};

/**
 * The brand tokens from DESIGN.md. Amber is allowed as a fill, the 2px rule
 * and the primary button; every amber word is amber 700, which holds 4.9:1 on
 * paper. Body and headings are ink on paper.
 */
export const brand = {
  amber: "#F2A93B",
  amberText: "#9C600C",
  ink: "#141315",
  paper: "#FCFAF6",
  surface: "#F5F0E8",
  hairline: "#E4DED2",
  muted: "#625A50",
} as const;

/**
 * Fraunces and Inter load where the client supports web fonts. Everywhere else
 * the stacks fall back to a serif for display and a system sans for text, so
 * the hierarchy survives without the webfont.
 */
export const displayFont = "Fraunces, Georgia, 'Times New Roman', serif";
export const textFont =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif";

export const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const year = () => new Date().getFullYear();

/** `24h` reads as `24 hours`; an unrecognised value is shown as written. */
export const durationLabel = (value: string) => {
  const match = /^(\d+)\s*([smhd])$/i.exec(value.trim());
  if (!match) return value;

  const units = { s: "second", m: "minute", h: "hour", d: "day" } as const;
  const amount = Number(match[1]);
  const unit = units[match[2].toLowerCase() as keyof typeof units];

  return `${amount} ${unit}${amount === 1 ? "" : "s"}`;
};

type TEmailLayout = {
  title: string;
  /** The inbox line shown next to the subject, before the body is opened. */
  preview: string;
  heading: string;
  /** MJML nodes for the body. Dynamic values are escaped by the caller. */
  content: string;
  footerNote?: string;
  /** Off for internal mail, where the inbox already is the team address. */
  showContact?: boolean;
};

const layout = ({
  title,
  preview,
  heading,
  content,
  footerNote = "You received this email because you have a TechTipsHub account.",
  showContact = true,
}: TEmailLayout) => `<mjml lang="en">
  <mj-head>
    <mj-title>${escapeHtml(title)}</mj-title>
    <mj-preview>${escapeHtml(preview)}</mj-preview>
    <mj-font name="Fraunces" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600&display=swap" />
    <mj-font name="Inter" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap" />
    <mj-attributes>
      <mj-all font-family="${textFont}" />
      <mj-text color="${brand.ink}" font-size="16px" line-height="1.6" padding="0 0 16px 0" />
      <mj-button background-color="${brand.amber}" color="${brand.ink}" border-radius="6px" font-family="${textFont}" font-size="15px" font-weight="600" inner-padding="14px 22px" align="left" padding="0 0 16px 0" />
      <mj-divider border-color="${brand.hairline}" border-width="1px" padding="0" />
    </mj-attributes>
    <mj-style>
      a { color: ${brand.amberText}; }
    </mj-style>
  </mj-head>
  <mj-body background-color="${brand.paper}" width="600px">
    <mj-section padding="32px 24px 0 24px">
      <mj-column>
        <mj-table cellpadding="0" cellspacing="0" role="presentation" width="100%" padding="0">
          <tr>
            <td width="40" aria-hidden="true" style="width:40px;height:40px;background-color:${brand.amber};border-radius:6px;text-align:center;vertical-align:middle;font-family:${displayFont};font-size:24px;font-weight:600;line-height:40px;color:${brand.ink};">T</td>
            <td style="padding-left:12px;vertical-align:middle;font-family:${displayFont};font-size:18px;color:${brand.ink};letter-spacing:-0.01em;">TechTipsHub</td>
          </tr>
        </mj-table>
      </mj-column>
    </mj-section>

    <mj-section padding="24px 24px 0 24px">
      <mj-column>
        <mj-divider border-width="2px" border-color="${brand.amber}" padding="0" />
      </mj-column>
    </mj-section>

    <mj-section padding="32px 24px 0 24px">
      <mj-column>
        <mj-text padding="0 0 20px 0">
          <h1 style="margin:0;font-family:${displayFont};font-size:30px;line-height:1.2;font-weight:600;letter-spacing:-0.015em;color:${brand.ink};">${escapeHtml(heading)}</h1>
        </mj-text>
        ${content}
      </mj-column>
    </mj-section>

    <mj-section padding="40px 24px 32px 24px">
      <mj-column>
        <mj-divider border-width="1px" border-color="${brand.hairline}" padding="0 0 20px 0" />
        <mj-text font-size="13px" line-height="1.6" color="${brand.muted}" padding="0 0 8px 0">${footerNote}</mj-text>
        ${
          showContact
            ? `<mj-text font-size="13px" line-height="1.6" color="${brand.muted}" padding="0">
          Questions? Write to <a href="mailto:${CONTACT_INBOX}" style="color:${brand.amberText};text-decoration:underline;">${CONTACT_INBOX}</a>
        </mj-text>`
            : ""
        }
        <mj-text font-size="12px" line-height="1.6" color="${brand.muted}" padding="16px 0 0 0">&copy; ${year()} TechTipsHub</mj-text>
      </mj-column>
    </mj-section>
  </mj-body>
</mjml>`;

/**
 * Compile MJML to the table-based HTML email clients need. The layout is one
 * column, so it reflows on a phone without a breakpoint, and MJML supplies the
 * Outlook conditionals and the fluid container.
 */
export const renderEmail = async (options: TEmailLayout): Promise<string> => {
  const { html, errors } = await mjml2html(layout(options), {
    validationLevel: "strict",
    keepComments: true,
  });

  if (errors.length > 0) {
    throw new Error(
      `Email template validation failed: ${errors
        .map((error) => error.formattedMessage)
        .join("; ")}`,
    );
  }

  return html;
};
