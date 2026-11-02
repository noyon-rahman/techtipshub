"use client";

import { categoriesPath } from "@/lib/feed-routes";
import { Button } from "@heroui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuFolderTree } from "react-icons/lu";

/**
 * Categories, for the widths where the rails are hidden.
 *
 * The right rail only exists from 1280px up, so without this a reader on a
 * phone had no way into the category list from the feed at all. It sits on the
 * same row as the feed switch and uses the same quiet treatment, so it reads
 * as navigation rather than a second action.
 *
 * On `/categories` itself it is left out: a shortcut to the page you are
 * already on is the one thing that row does not need.
 */
const CategoriesButton = () => {
  const pathname = usePathname();
  const active = pathname?.startsWith(categoriesPath) ?? false;

  if (active) return null;

  return (
    <Button
      as={Link}
      href={categoriesPath}
      radius="full"
      className="shrink-0 bg-transparent px-2 font-medium text-default-600 hover:bg-default-100 hover:text-foreground min-[420px]:px-3"
      startContent={<LuFolderTree aria-hidden className="text-lg" />}
    >
      Categories
    </Button>
  );
};

export default CategoriesButton;
