"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Resets internal scroll position of sticky feed rails on route change so
 * navigating between feed/category pages never leaves the right rail scrolled
 * past the top of the Categories card.
 */
export default function RailScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    const rails = document.querySelectorAll<HTMLElement>(
      ".tth-rail, .tth-rail-inner",
    );
    for (const rail of rails) {
      rail.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}

