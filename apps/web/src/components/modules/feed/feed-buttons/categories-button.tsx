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
 */
const CategoriesButton = () => {
  const pathname = usePathname();
  const active = pathname?.startsWith(categoriesPath) ?? false;

  return (
    <Button
      as={Link}
      href={categoriesPath}
      radius="full"
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "bg-default-200 font-medium text-foreground"
          : "bg-transparent font-medium text-default-600 hover:bg-default-100 hover:text-foreground"
      }
      startContent={<LuFolderTree aria-hidden className="text-lg" />}
    >
      Categories
    </Button>
  );
};

export default CategoriesButton;
