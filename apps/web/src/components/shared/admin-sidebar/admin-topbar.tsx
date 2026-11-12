"use client";

import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
} from "@heroui/react";
import UserAvatar from "@/components/ui/user-avatar";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { FiExternalLink, FiLogOut, FiPlus, FiSearch } from "react-icons/fi";
import { HiOutlinePencilSquare, HiOutlineUserCircle } from "react-icons/hi2";
import { MdMenu } from "react-icons/md";
import { ThemeSwitch } from "@/components/ui/theme-switch";
import { useUser } from "@/context/user.provider";
import { useAdminSearch } from "@/hooks/admin";
import { manageBlogsPath } from "@/lib/blog-routes";
import { logOutUser } from "@/services/auth";
import { adminLinks, findAdminLink, navIcon } from "./admin-links";
import { useAdminShell } from "./admin-shell";

interface SearchResult {
  key: string;
  group: string;
  href: string;
  title: string;
  detail?: string;
  avatar?: string;
  icon?: React.ReactNode;
}

interface SearchPayload {
  blogs?: { _id?: string; title?: string; slug?: string }[];
  members?: {
    _id?: string;
    fullName?: string;
    username?: string;
    email?: string;
    profilePicture?: string;
  }[];
  categories?: { _id?: string; name?: string }[];
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return EDITABLE_TAGS.has(element.tagName) || element.isContentEditable;
};

/**
 * Search state lives in a component keyed by the path, so arriving on a new
 * screen closes the panel and empties the field without an effect that would
 * reset state after a render.
 */
function AdminSearch() {
  const router = useRouter();
  const { isSearchOpen, openSearch, closeSearch } = useAdminShell();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(0);

  const baseId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = query.trim();
  const { data, isFetching, isError } = useAdminSearch(trimmed);
  const payload = (data as { data?: SearchPayload } | undefined)?.data;

  const results = useMemo<SearchResult[]>(() => {
    const items: SearchResult[] = [];
    const lower = trimmed.toLowerCase();

    adminLinks.forEach((link) => {
      if (
        !lower ||
        link.label.toLowerCase().includes(lower) ||
        (link.group && link.group.toLowerCase().includes(lower)) ||
        link.description.toLowerCase().includes(lower)
      ) {
        items.push({
          key: `page-${link.id}`,
          group: "Pages",
          href: link.href,
          title: link.label,
          detail: link.group,
          icon: navIcon(link.icon, 16),
        });
      }
    });

    (payload?.blogs ?? []).forEach((blog, index) => {
      if (!blog?.slug || !blog?.title) return;
      items.push({
        key: `blog-${blog._id ?? index}`,
        group: "Articles",
        href: `/blogs/${blog.slug}`,
        title: blog.title,
      });
    });

    (payload?.members ?? []).forEach((member) => {
      if (!member?._id) return;
      items.push({
        key: `member-${member._id}`,
        group: "Members",
        href: `/admin/manage-users/${member._id}`,
        title:
          member.fullName ||
          member.username ||
          member.email ||
          "Unnamed member",
        detail: member.username ? `@${member.username}` : member.email,
        avatar: member.profilePicture,
      });
    });

    (payload?.categories ?? []).forEach((category) => {
      if (!category?._id || !category?.name) return;
      items.push({
        key: `category-${category._id}`,
        group: "Categories",
        href: `/admin/categories?q=${encodeURIComponent(category.name)}`,
        title: category.name,
        detail: "Open in Categories",
      });
    });

    return items;
  }, [payload, trimmed]);

  const activeIndex = Math.min(picked, Math.max(results.length - 1, 0));

  const handleClose = useCallback(() => {
    setQuery("");
    setPicked(0);
    closeSearch();
  }, [closeSearch]);

  // Ctrl K opens from anywhere; "/" opens when the caret is not in a field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isShortcut =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      const isSlash =
        event.key === "/" &&
        !isTypingTarget(event.target) &&
        !event.metaKey &&
        !event.ctrlKey;

      if (!isShortcut && !isSlash) return;
      event.preventDefault();
      openSearch();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);

  useEffect(() => {
    if (!isSearchOpen) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      handleClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isSearchOpen, handleClose]);

  const goToResult = (result: SearchResult) => {
    handleClose();
    router.push(result.href);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (results.length) setPicked((activeIndex + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length) {
        setPicked((activeIndex - 1 + results.length) % results.length);
      }
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      goToResult(results[activeIndex]);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        aria-expanded={isSearchOpen}
        aria-controls={`${baseId}-dialog`}
        className={`inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-[6px] text-default-700 transition-colors hover:bg-default-100 hover:text-foreground lg:hidden ${focusRing}`}
      >
        <FiSearch aria-hidden className="size-5" />
        <span className="sr-only">Search pages and actions</span>
      </button>

      {isSearchOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-[2px]"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget) handleClose();
            }}
          >
            <div
              id={`${baseId}-dialog`}
              role="dialog"
              aria-modal="true"
              aria-label="Search pages, articles, members, and categories"
              className="w-full max-w-[34rem] overflow-hidden rounded-xl border border-default/60 bg-content-1 shadow-2xl"
            >
              <div className="flex items-center gap-2.5 border-b border-default/60 px-3.5 py-2.5">
                <FiSearch
                  aria-hidden
                  className="size-4 shrink-0 text-default-500"
                />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  role="combobox"
                  aria-label="Search pages, articles, members, or categories"
                  aria-expanded={isSearchOpen}
                  aria-autocomplete="list"
                  aria-controls={`${baseId}-results`}
                  aria-activedescendant={
                    results.length
                      ? `${baseId}-option-${activeIndex}`
                      : undefined
                  }
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPicked(0);
                  }}
                  onKeyDown={onInputKeyDown}
                  placeholder="Search pages, articles, members, or categories..."
                  className="h-8 min-w-0 flex-1 bg-transparent text-sm text-foreground placeholder:text-default-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleClose}
                  className={`rounded border border-default/70 bg-default-50 px-1.5 py-0.5 text-[0.6875rem] font-medium text-default-600 transition-colors hover:bg-default-100 hover:text-foreground ${focusRing}`}
                >
                  esc
                </button>
              </div>

              <div className="max-h-[22rem] overflow-y-auto p-1.5">
                {isFetching && results.length === 0 ? (
                  <p
                    className="px-3 py-4 text-xs text-default-600"
                    role="status"
                  >
                    Searching for “{trimmed}”...
                  </p>
                ) : isError && results.length === 0 ? (
                  <p
                    className="px-3 py-4 text-xs leading-relaxed text-danger"
                    role="alert"
                  >
                    Search is unavailable right now: the admin API did not
                    answer. Try again in a moment.
                  </p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-4 text-xs leading-relaxed text-default-600">
                    Nothing matches “{trimmed}”. Try a page name, article title,
                    member email, or category.
                  </p>
                ) : (
                  <ul
                    id={`${baseId}-results`}
                    role="listbox"
                    aria-label="Search results"
                  >
                    {results.map((result, index) => {
                      const showGroup =
                        index === 0 ||
                        results[index - 1].group !== result.group;
                      const active = index === activeIndex;

                      return (
                        <li key={result.key}>
                          {showGroup && (
                            <p
                              className="tth-label-sm px-2.5 pb-1 pt-2.5 first:pt-1"
                              aria-hidden
                            >
                              {result.group}
                            </p>
                          )}
                          <Link
                            href={result.href}
                            id={`${baseId}-option-${index}`}
                            role="option"
                            aria-selected={active}
                            onClick={() => goToResult(result)}
                            onMouseEnter={() => setPicked(index)}
                            className={`flex min-h-10 items-center justify-between gap-3 rounded-[8px] px-2.5 py-1.5 text-sm transition-colors ${
                              active
                                ? "bg-primary/12 text-foreground"
                                : "text-default-700 hover:bg-default-100/60"
                            }`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              {result.avatar !== undefined ? (
                                <UserAvatar
                                  src={result.avatar || undefined}
                                  size="sm"
                                  className="size-6 shrink-0"
                                />
                              ) : result.icon ? (
                                <span
                                  aria-hidden
                                  className={`shrink-0 ${
                                    active
                                      ? "text-primary-accessible"
                                      : "text-default-500"
                                  }`}
                                >
                                  {result.icon}
                                </span>
                              ) : (
                                <span
                                  aria-hidden
                                  className={`h-3.5 w-0.5 shrink-0 rounded-full ${
                                    active ? "bg-primary" : "bg-default-300"
                                  }`}
                                />
                              )}
                              <span className="truncate font-medium">
                                {result.title}
                              </span>
                            </span>

                            <span className="flex shrink-0 items-center gap-2 text-xs text-default-500">
                              {result.detail && (
                                <span className="max-w-[12rem] truncate">
                                  {result.detail}
                                </span>
                              )}
                              {active && (
                                <span
                                  aria-hidden
                                  className="text-xs font-medium text-primary-accessible"
                                >
                                  ↵
                                </span>
                              )}
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between border-t border-default/60 bg-default-50/50 px-3.5 py-2 text-[0.6875rem] text-default-600">
                <div className="flex items-center gap-3">
                  <span>↑↓ move</span>
                  <span>↵ open</span>
                </div>
                <span>Ctrl K anywhere</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/**
 * One thin bar at every width: where you are, the global search, the theme
 * switch (the only one in the shell), and the account menu. Below lg the
 * first slot is the drawer trigger instead of the breadcrumb, so no row ever
 * carries two copies of a control.
 */
export default function AdminTopbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, setIsLoading: setUserLoading } = useUser();
  const { openNav, isNavOpen } = useAdminShell();

  const current = findAdminLink(pathname);
  const group = current?.group ?? "Overview";
  const label = current?.label ?? "Admin";

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logOutUser();
    setUserLoading(true);
    router.push("/");
  };

  const avatarName = (user?.name || user?.username || "?")
    .charAt(0)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-default/60 bg-background lg:rounded-t-2xl">
      <div className="flex h-14 items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-7">
        <button
          type="button"
          onClick={openNav}
          aria-expanded={isNavOpen}
          aria-controls="admin-nav-panel"
          className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-[6px] px-2 text-sm font-medium text-default-700 transition-colors hover:bg-default-100 hover:text-foreground lg:hidden ${focusRing}`}
        >
          <MdMenu aria-hidden className="size-5" />
          Menu
        </button>

        <div className="hidden min-w-0 items-center gap-2.5 lg:flex">
          <span className="truncate text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground">
            {label}
          </span>
          {group !== "Overview" && (
            <span className="rounded-md border border-default/60 bg-content-1 px-2 py-0.5 text-xs font-medium text-default-600">
              {group}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
          <AdminSearch key={pathname} />
          <Link
            href="/admin/manage-blogs/new"
            className={`hidden h-8 items-center gap-1.5 rounded-[7px] bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-500 sm:inline-flex ${focusRing}`}
          >
            <FiPlus aria-hidden className="size-3.5" />
            New article
          </Link>
          <span
            aria-hidden
            className="mx-0.5 hidden h-5 w-px bg-default/60 sm:block"
          />
          <ThemeSwitch
            className="flex min-h-11 min-w-11 items-center justify-center sm:min-h-9 sm:min-w-9"
            classNames={{ wrapper: "size-8" }}
          />

          <Dropdown placement="bottom-end">
            <DropdownTrigger>
              <button
                type="button"
                aria-label="Account menu"
                className={`inline-flex min-h-11 items-center gap-1.5 rounded-md px-1 text-default-700 transition-colors hover:bg-default-100 sm:min-h-9 ${focusRing}`}
              >
                <UserAvatar
                  src={user?.profilePicture}
                  size="sm"
                  className="size-8 shrink-0 object-cover"
                  name={avatarName}
                />
              </button>
            </DropdownTrigger>
            <DropdownMenu
              aria-label="Account"
              disabledKeys={isLoggingOut ? ["logout"] : undefined}
              classNames={{ base: "min-w-56" }}
            >
              <DropdownItem
                key="who"
                isReadOnly
                textValue={user?.name || user?.username || "Signed in"}
                className="opacity-100 data-[hover=true]:bg-transparent"
              >
                <p className="text-sm font-medium text-foreground">
                  {user?.name || user?.username || "Signed in"}
                </p>
                <p className="truncate text-xs text-default-600">
                  {user?.role ?? "Admin"}
                  {user?.email ? ` · ${user.email}` : ""}
                </p>
              </DropdownItem>
              <DropdownItem
                key="profile"
                as={Link}
                href="/admin/profile"
                startContent={
                  <HiOutlineUserCircle aria-hidden className="size-4" />
                }
              >
                Your profile
              </DropdownItem>
              <DropdownItem
                key="articles"
                as={Link}
                href={manageBlogsPath}
                startContent={
                  <HiOutlinePencilSquare aria-hidden className="size-4" />
                }
              >
                Your articles
              </DropdownItem>
              <DropdownItem
                key="site"
                as={Link}
                href="/"
                startContent={<FiExternalLink aria-hidden className="size-4" />}
              >
                Back to the site
              </DropdownItem>
              <DropdownItem
                key="logout"
                color="danger"
                onPress={handleLogout}
                startContent={<FiLogOut aria-hidden className="size-4" />}
              >
                {isLoggingOut ? "Logging out..." : "Log out"}
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
