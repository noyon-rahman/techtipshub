"use client";

import { writeBlogPath } from "@/lib/blog-routes";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { HiOutlinePencilSquare } from "react-icons/hi2";
import { FiMenu, FiX } from "react-icons/fi";
import { useUser } from "@/context/user.provider";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/shared/logo";
import LoginLogoutSwitch from "@/components/ui/login-logout-switch";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import NavbarSearchInput from "./navbar-search-input";

const isActivePath = (pathname: string | null, href: string) =>
  href === "/" ? pathname === "/" : Boolean(pathname?.startsWith(href));

/**
 * The site header.
 *
 * One row at every width, holding only what belongs on it: the brand, the four
 * pages where there is room for them, search, and the account controls. Links
 * are full-height cells rather than floating pills, so the bar reads as a
 * strip of equal targets and the current page is marked by a rule that lands
 * on the header's own bottom border. Hovering an inactive link shows that rule
 * faintly, so where a press leads is visible before the press.
 *
 * Narrow screens do not get a scaled-down copy of that row. There is no width
 * for four links and a growing search field, so they move into the drawer,
 * which is one tap away from the menu button, and the bar keeps only the three
 * things a phone needs: how to get anywhere (menu), where home is (brand) and
 * who you are (account). The menu button takes the far left, where a thumb
 * already rests.
 *
 * Search is the one control that cannot leave: the palette is the site's
 * search, so on tablets it becomes an icon in the same slot as the desktop
 * field and opens the same palette.
 */
export const Navbar = () => {
  const pathname = usePathname();
  const { user } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  // A drawer left open must not survive a navigation it did not trigger: a
  // back gesture or a link inside the page would otherwise return the reader
  // to a menu covering the screen.
  const [openForPath, setOpenForPath] = useState<string | null>(null);
  if (openForPath !== null && openForPath !== pathname) {
    setOpenForPath(null);
    setMenuOpen(false);
  }

  const toggleMenu = () => {
    const next = !menuOpen;
    setMenuOpen(next);
    setOpenForPath(next ? pathname : null);
  };

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setOpenForPath(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    setOpenForPath(null);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-default/60 bg-background/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-page items-stretch gap-1 px-4 sm:gap-3 sm:px-6 lg:px-8">
        {/* Menu and brand. On phones the button leads; from `sm` the brand
            does, and the button sits beside it as it was. */}
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={toggleMenu}
            className="-ml-2.5 flex size-11 items-center justify-center rounded-full text-default-600 transition-colors hover:bg-default-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 sm:order-2 sm:ml-1 sm:size-10 lg:hidden"
          >
            {menuOpen ? (
              <FiX className="size-5" aria-hidden />
            ) : (
              <FiMenu className="size-5" aria-hidden />
            )}
          </button>

          <Link
            href="/"
            aria-label="TechTipsHub home"
            className="flex items-center rounded-md transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 sm:order-1"
          >
            {/*
              One lockup, not two. Rendering a smaller copy alongside and
              toggling them with `hidden`/`sm:inline-flex` only works while the
              two stay in sync; mounting a single element and stepping the
              wordmark's size at `sm` cannot drift apart, and it keeps the
              link's accessible name to one "TechTipsHub".
            */}
            <Logo size="md" wordClass="text-[0.9375rem] sm:text-base" />
          </Link>
        </div>

        {/* Primary navigation. Each link spans the bar's full height so the
            2px current-state rule lands on the header's own bottom border
            instead of floating inside it. */}
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex h-full items-stretch gap-1">
            {siteConfig.navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href} className="flex">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus/70 ${
                      active
                        ? "border-primary text-foreground"
                        : "border-transparent text-default-600 hover:border-default-300 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Search grows to fill the middle, up to 16rem: wide enough for the
            placeholder and the ⌘K hint, narrow enough that it does not read as
            the header's main control. The cap is an arbitrary value on purpose;
            `max-w-2xs` is not in this Tailwind scale and silently resolves to
            nothing. `w-0` gives the flex item a real starting basis, with
            `min-w-0` to stop the row's gap from holding it open. */}
        <div className="ml-auto hidden w-0 min-w-0 max-w-[16rem] flex-1 items-center lg:flex">
          <NavbarSearchInput />
        </div>

        {/* Actions */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2 lg:ml-2">
          <div className="flex items-center lg:hidden">
            <NavbarSearchInput compact />
          </div>

          <ThemeSwitch />

          {user ? (
            <Button
              as={Link}
              href={writeBlogPath}
              size="sm"
              radius="full"
              color="primary"
              startContent={<HiOutlinePencilSquare className="text-base" />}
              aria-label="Write a blog"
              className="hidden font-medium shadow-none active:scale-95 sm:inline-flex"
            >
              Write
            </Button>
          ) : null}

          <LoginLogoutSwitch />
        </div>
      </div>

      {/* Mobile navigation drawer. From `lg` the row carries the same links,
          so the drawer only exists below that. */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            id="mobile-nav"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden border-t border-default/60 bg-background lg:hidden"
          >
            <div className="space-y-3 px-4 py-4 sm:px-6">
              <div className="sm:hidden">
                <NavbarSearchInput block />
              </div>

              <nav aria-label="Main (mobile)">
                <ul>
                  {siteConfig.navMenuItems.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={closeMenu}
                          aria-current={active ? "page" : undefined}
                          className={`flex min-h-11 items-center justify-between rounded-lg px-3 text-[0.9375rem] font-medium transition-colors ${
                            active
                              ? "bg-primary/10 text-primary-accessible"
                              : "text-default-700 hover:bg-default-100 hover:text-foreground"
                          }`}
                        >
                          {item.label}
                          {active && (
                            <span
                              aria-hidden
                              className="size-1.5 rounded-full bg-primary-accessible"
                            />
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>

              {user ? (
                <Button
                  as={Link}
                  href={writeBlogPath}
                  onPress={closeMenu}
                  fullWidth
                  radius="lg"
                  color="primary"
                  startContent={<HiOutlinePencilSquare className="text-base" />}
                >
                  Write a blog
                </Button>
              ) : (
                // Below `sm` the top bar keeps only the theme switch, so the
                // account actions live here where there is room to hit them.
                <div className="flex flex-col gap-2 pt-1 sm:hidden">
                  <Button
                    as={Link}
                    className="font-medium"
                    href="/login"
                    onPress={closeMenu}
                    fullWidth
                    radius="lg"
                    variant="bordered"
                  >
                    Log in
                  </Button>
                  <Button
                    as={Link}
                    className="font-semibold"
                    href="/signup"
                    onPress={closeMenu}
                    fullWidth
                    radius="lg"
                    color="primary"
                  >
                    Sign up
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};
