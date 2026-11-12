"use client";

import { writeBlogPath } from "@/lib/blog-routes";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@heroui/react";
import { AnimatePresence, motion } from "framer-motion";
import { HiOutlinePencilSquare } from "react-icons/hi2";
import {
  FiBookOpen,
  FiGrid,
  FiHome,
  FiInfo,
  FiMail,
  FiMenu,
  FiSliders,
  FiUsers,
  FiX,
} from "react-icons/fi";
import { useUser } from "@/context/user.provider";
import { siteConfig } from "@/config/site";
import { Logo } from "@/components/shared/logo";
import LoginLogoutSwitch from "@/components/ui/login-logout-switch";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import NavbarSearchInput from "./navbar-search-input";

const isActivePath = (pathname: string | null, href: string) => {
  if (!pathname) return false;
  if (href === "/") {
    return (
      pathname === "/" ||
      pathname === "/personalized" ||
      pathname === "/following" ||
      pathname.startsWith("/categories")
    );
  }
  return pathname.startsWith(href);
};

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

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setOpenForPath(null);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    setOpenForPath(null);
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-default/50 bg-background/85 backdrop-blur-md print:hidden">
      <div className="mx-auto flex h-16 w-full max-w-page items-center gap-4 px-4 sm:px-6 lg:px-8">
        {/* Menu and brand */}
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={toggleMenu}
            className="-ml-2 flex size-11 items-center justify-center rounded-[6px] text-default-600 transition-colors hover:bg-default-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:order-2 sm:ml-1 sm:size-9 lg:hidden"
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
            className="flex items-center rounded-[6px] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:order-1"
          >
            <Logo size="md" wordClass="text-[0.9375rem] sm:text-base" />
          </Link>
        </div>

        {/* Primary navigation */}
        <nav aria-label="Main" className="ml-2 hidden lg:block">
          <ul className="flex items-center gap-1">
            {siteConfig.navItems.map((item) => {
              const active = isActivePath(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`inline-flex h-9 items-center rounded-[6px] px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                      active
                        ? "bg-primary/12 font-semibold text-primary-accessible"
                        : "font-medium text-default-600 hover:bg-default-100/80 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Actions: consistent 36px (h-9) height on sm+, 44px tap targets on phones */}
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden w-64 items-center lg:flex">
            <NavbarSearchInput />
          </div>

          <div className="flex items-center lg:hidden">
            <NavbarSearchInput compact />
          </div>

          {user ? (
            <Button
              as={Link}
              href={writeBlogPath}
              size="sm"
              radius="sm"
              color="primary"
              startContent={<HiOutlinePencilSquare className="text-base" />}
              aria-label="Write a blog"
              className="hidden h-9 rounded-[6px] px-3.5 text-sm font-semibold shadow-none transition-transform active:scale-95 sm:inline-flex"
            >
              Write
            </Button>
          ) : null}

          <LoginLogoutSwitch />
        </div>
      </div>
    </header>

      {/* Mobile slide-over drawer. Rendered as a sibling outside <header> so
          header's backdrop-blur does not create a containing block for fixed positioning. */}
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div
              aria-hidden
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={closeMenu}
              className="fixed inset-0 bg-ink/50 backdrop-blur-xs"
            />

            <motion.aside
              id="mobile-nav"
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 flex h-dvh w-[min(20rem,86vw)] flex-col border-r border-default/60 bg-background shadow-2xl"
            >
              <div className="flex h-16 shrink-0 items-center justify-between border-b border-default/60 px-4">
                <Link
                  href="/"
                  onClick={closeMenu}
                  aria-label="TechTipsHub home"
                  className="flex items-center rounded-[6px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Logo size="md" wordClass="text-[0.9375rem]" />
                </Link>
                <button
                  type="button"
                  onClick={closeMenu}
                  aria-label="Close menu"
                  className="-mr-2 flex size-11 items-center justify-center rounded-[6px] text-default-600 transition-colors hover:bg-default-100 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <FiX className="size-5" aria-hidden />
                </button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-4 py-5">
                <NavbarSearchInput block />

                <nav aria-label="Browse">
                  <p className="mb-2 px-3 tth-label-sm">Browse</p>
                  <ul className="space-y-1">
                    {[
                      {
                        href: "/",
                        label: "Feed",
                        icon: <FiHome className="size-4" aria-hidden />,
                        active: pathname === "/",
                      },
                      ...(user
                        ? [
                            {
                              href: "/personalized",
                              label: "Personalized",
                              icon: (
                                <FiSliders className="size-4" aria-hidden />
                              ),
                              active: pathname === "/personalized",
                            },
                            {
                              href: "/following",
                              label: "Following",
                              icon: <FiUsers className="size-4" aria-hidden />,
                              active: pathname === "/following",
                            },
                          ]
                        : []),
                      {
                        href: "/categories",
                        label: "Categories",
                        icon: <FiGrid className="size-4" aria-hidden />,
                        active: Boolean(pathname?.startsWith("/categories")),
                      },
                    ].map((item) => (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          onClick={closeMenu}
                          aria-current={item.active ? "page" : undefined}
                          className={`flex min-h-11 items-center gap-3 rounded-[6px] px-3 text-[0.9375rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                            item.active
                              ? "bg-primary/12 font-semibold text-primary-accessible"
                              : "font-medium text-default-700 hover:bg-default-100 hover:text-foreground"
                          }`}
                        >
                          {item.icon}
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </nav>

                <nav aria-label="Publication">
                  <p className="mb-2 px-3 tth-label-sm">Publication</p>
                  <ul className="space-y-1">
                    {[
                      {
                        href: "/features",
                        label: "Features",
                        icon: <FiBookOpen className="size-4" aria-hidden />,
                      },
                      {
                        href: "/about",
                        label: "About",
                        icon: <FiInfo className="size-4" aria-hidden />,
                      },
                      {
                        href: "/contact",
                        label: "Contact",
                        icon: <FiMail className="size-4" aria-hidden />,
                      },
                    ].map((item) => {
                      const active = Boolean(pathname?.startsWith(item.href));
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={closeMenu}
                            aria-current={active ? "page" : undefined}
                            className={`flex min-h-11 items-center gap-3 rounded-[6px] px-3 text-[0.9375rem] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                              active
                                ? "bg-primary/12 font-semibold text-primary-accessible"
                                : "font-medium text-default-700 hover:bg-default-100 hover:text-foreground"
                            }`}
                          >
                            {item.icon}
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>

                <div className="flex min-h-11 items-center justify-between rounded-[6px] border border-default/60 bg-content-1 px-3 py-2 text-sm font-medium text-default-700">
                  <span>Appearance</span>
                  <ThemeSwitch className="flex size-9 items-center justify-center rounded-[6px] hover:bg-default-100" />
                </div>
              </div>

              <div className="shrink-0 border-t border-default/60 bg-content-1/60 p-4">
                {user ? (
                  <Button
                    as={Link}
                    href={writeBlogPath}
                    onPress={closeMenu}
                    fullWidth
                    radius="sm"
                    color="primary"
                    className="min-h-11 rounded-[6px] font-semibold"
                    startContent={
                      <HiOutlinePencilSquare className="text-base" />
                    }
                  >
                    Write a blog
                  </Button>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5">
                    <Button
                      as={Link}
                      className="min-h-11 rounded-[6px] font-medium"
                      href="/login"
                      onPress={closeMenu}
                      fullWidth
                      radius="sm"
                      variant="bordered"
                    >
                      Log in
                    </Button>
                    <Button
                      as={Link}
                      className="min-h-11 rounded-[6px] font-semibold"
                      href="/signup"
                      onPress={closeMenu}
                      fullWidth
                      radius="sm"
                      color="primary"
                    >
                      Sign up
                    </Button>
                  </div>
                )}
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
