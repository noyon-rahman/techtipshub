import type { ReactNode } from "react";

/**
 * The card every admin list lives in. One frame for articles, comments,
 * categories, trash and members: same hairline, same radius, same fill, no
 * shadow. The shadow on `SectionCard` marks a titled panel; the list card has
 * no title strip because the page header above it already names the screen, so
 * a shadow here would only lift it for no reason.
 *
 * Children stack straight down: toolbar, table, footer. Each of them draws its
 * own hairline, so the frame itself only clips the corners.
 */
export default function ListFrame({
  children,
  label,
}: {
  children: ReactNode;
  /** Screen-reader name for the whole list region. */
  label: string;
}) {
  return (
    <section
      aria-label={label}
      className="overflow-hidden rounded-xl border border-default/60 bg-content-1"
    >
      {children}
    </section>
  );
}
