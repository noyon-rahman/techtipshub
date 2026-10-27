import {
  brand,
  displayFont,
  escapeHtml,
  renderEmail,
  textFont,
  type TEmailMessage,
} from "./layout";

export type TCampaignArticle = {
  title: string;
  href: string;
  excerpt: string;
  coverImage?: string;
  category?: string;
};

export type TCampaignContent = {
  subject: string;
  preview: string;
  heading: string;
  intro: string;
  articles: TCampaignArticle[];
};

export type TCampaignEmailArgs = {
  content: TCampaignContent;
  /** Greeting name; empty falls back to a greeting with no name. */
  name: string;
  /** Absolute opt-out for this recipient. */
  unsubscribeUrl: string;
};

const introParagraphs = (intro: string) =>
  intro
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

/**
 * One article in the mail: a cover at the mail's measure when there is one,
 * then the category as a label, the title as the link, and the excerpt.
 *
 * The card is a hairline table rather than a rounded box: Outlook drops the
 * radius and the fill, and the rule is what still separates two articles
 * there. Amber appears once per card, on the title, because that is the link
 * a reader acts on.
 */
const articleBlock = (article: TCampaignArticle, index: number) => {
  const title = escapeHtml(article.title);
  const href = escapeHtml(article.href);
  const category = article.category
    ? `<tr><td style="padding:0 0 6px 0;font-family:${textFont};font-size:12px;line-height:1.4;color:${brand.amberText};">${escapeHtml(article.category)}</td></tr>`
    : "";
  const excerpt = article.excerpt
    ? `<tr><td style="padding:6px 0 0 0;font-family:${textFont};font-size:15px;line-height:1.6;color:${brand.muted};">${escapeHtml(article.excerpt)}</td></tr>`
    : "";
  const cover = article.coverImage
    ? `<tr><td style="padding:0 0 14px 0;">
         <a href="${href}" style="text-decoration:none;"><img src="${escapeHtml(article.coverImage)}" width="552" alt="" style="display:block;width:100%;max-width:552px;height:auto;border:0;border-radius:10px;background-color:${brand.surface};" /></a>
       </td></tr>`
    : "";

  return `
    ${index === 0 ? "" : `<mj-text padding="0 0 0 0"><div style="height:1px;background-color:${brand.hairline};margin:28px 0;"></div></mj-text>`}
    <mj-text padding="0 0 0 0">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
        ${cover}
        <tr><td>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;">
            ${category}
            <tr><td style="padding:0;font-family:${displayFont};font-size:21px;line-height:1.25;font-weight:600;letter-spacing:-0.01em;"><a href="${href}" style="color:${brand.ink};text-decoration:none;">${title}</a></td></tr>
            ${excerpt}
            <tr><td style="padding:10px 0 0 0;font-family:${textFont};font-size:14px;"><a href="${href}" style="color:${brand.amberText};text-decoration:underline;">Read the article</a></td></tr>
          </table>
        </td></tr>
      </table>
    </mj-text>
  `;
};

/**
 * The monthly roundup. Subject and body come from the campaign the admin
 * wrote; the layout around them is ours, so every issue looks like the site
 * and cannot break in an inbox.
 */
export const newsletterCampaignMessage = async ({
  content,
  name,
  unsubscribeUrl,
}: TCampaignEmailArgs): Promise<TEmailMessage> => {
  const greeting = name ? `Hi ${escapeHtml(name)},` : "Hi there,";

  const paragraphs = introParagraphs(content.intro)
    .map((paragraph) => escapeHtml(paragraph))
    .join("<br /><br />");

  const html = await renderEmail({
    title: content.subject,
    preview: content.preview || content.subject,
    heading: content.heading,
    footerNote:
      "You get this because you asked for the TechTipsHub monthly roundup.",
    unsubscribeUrl,
    content: `
      ${
        greeting || paragraphs
          ? `<mj-text>${greeting}${paragraphs ? `<br /><br />${paragraphs}` : ""}</mj-text>`
          : ""
      }
      ${content.articles.map(articleBlock).join("")}
      ${content.articles.length === 0 ? `<mj-text>There are no articles in this issue.</mj-text>` : ""}
    `,
  });

  const text = [
    greeting,
    "",
    ...introParagraphs(content.intro),
    ...(introParagraphs(content.intro).length ? [""] : []),
    ...content.articles.flatMap((article) => [
      article.category ? `${article.category}` : "",
      article.title,
      article.excerpt,
      article.href,
      "",
    ]),
    "You get this because you asked for the TechTipsHub monthly roundup.",
    `Unsubscribe: ${unsubscribeUrl}`,
  ]
    .filter((line) => line !== undefined)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  return { subject: content.subject, html, text };
};
