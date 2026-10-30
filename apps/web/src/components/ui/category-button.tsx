import { ICategory } from "@/types";
import { categoryPath, searchPath } from "@/lib/feed-routes";
import Link from "next/link";

interface IProps extends ICategory {
  /** Marks the category whose page is open. */
  active?: boolean;
}

/** Missing marks the browser draws: focus, hover, the current page. */
const chipClass =
  "inline-flex min-h-8 items-center rounded-full bg-default-100 px-3 text-sm font-medium text-foreground transition-colors hover:bg-default-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-300 aria-[current=page]:bg-default-200";

/**
 * A category chip. It links to the category's own page rather than rewriting
 * the feed's query string, so the filter is crawlable and the page it lands on
 * can be cached. A name that cannot form a path falls back to the search that
 * covers it.
 *
 * A server component, and a `Link`: the chip used to be a button that called
 * `router.push` on the client, which cost every chip the ability to be opened
 * in a new tab, copied, and read as a link by a screen reader.
 */
const CategoryButton = ({ name, active = false }: IProps) => {
  const path = categoryPath(name);
  const href = path === "/" ? searchPath(name) : path;

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={chipClass}
    >
      {name}
    </Link>
  );
};

export default CategoryButton;
