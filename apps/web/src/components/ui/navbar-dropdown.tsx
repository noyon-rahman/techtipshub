"use client";

import {
  adminManageBlogsPath,
  manageBlogsPath,
  ownProfilePath,
  writeBlogPath,
} from "@/lib/blog-routes";
import UserAvatar from "@/components/ui/user-avatar";

import { protectedRoutes } from "@/constant";
import { useUser } from "@/context/user.provider";
import { logOutUser } from "@/services/auth";
import {
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownSection,
  DropdownTrigger,
} from "@heroui/react";
import { usePathname, useRouter } from "next/navigation";
import type { Key, ReactNode } from "react";
import { FiLogOut } from "react-icons/fi";
import {
  HiOutlineArrowTopRightOnSquare,
  HiOutlinePencilSquare,
  HiOutlineQueueList,
  HiOutlineSquares2X2,
  HiOutlineUserCircle,
} from "react-icons/hi2";

/** One row of the account menu. `key` is what the menu reports on press. */
interface IAccountLink {
  key: string;
  label: string;
  description: string;
  href: string;
  icon: ReactNode;
}

/**
 * What a member can do from the header.
 *
 * It repeats the account rail's two destinations on purpose: the menu is where
 * people look for "my articles" without leaving the page, and the rail is where
 * they go to work on them. Admins get their own list, since the account screens
 * are not their working surface.
 */
const accountLinks = (user: {
  username: string;
  role: string;
}): IAccountLink[] => {
  const profile: IAccountLink = {
    key: "profile",
    label: "Your profile",
    description: "Public page, photo and bio",
    href: ownProfilePath,
    icon: <HiOutlineUserCircle />,
  };

  if (user.role === "Admin") {
    return [
      {
        key: "dashboard",
        label: "Admin dashboard",
        description: "Traffic, content and members",
        href: "/admin/dashboard",
        icon: <HiOutlineSquares2X2 />,
      },
      {
        key: "admin-articles",
        label: "All articles",
        description: "Review, edit or remove",
        href: adminManageBlogsPath,
        icon: <HiOutlineQueueList />,
      },
      profile,
    ];
  }

  return [
    profile,
    {
      key: "articles",
      label: "Your articles",
      description: "Edit or delete what you published",
      href: manageBlogsPath,
      icon: <HiOutlineQueueList />,
    },
  ];
};

const NavarDropdown: React.FC = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { setIsLoading: setUserLoading, user } = useUser();

  if (!user) return null;

  const displayName = user.name || user.username;
  const initial = displayName.charAt(0).toUpperCase();
  const links = accountLinks({ username: user.username, role: user.role });

  const handleLogoutUser = async () => {
    await logOutUser();
    setUserLoading(true);

    if (protectedRoutes.some((route) => pathname.match(route))) {
      router.push("/");
    }
  };

  const onAction = (key: Key) => {
    if (key === "logout") {
      handleLogoutUser();
      return;
    }
    if (key === "write") {
      router.push(writeBlogPath);
      return;
    }
    const link = links.find((item) => item.key === key);
    if (link) router.push(link.href);
  };

  return (
    <Dropdown
      placement="bottom-end"
      offset={10}
      classNames={{
        content:
          "w-[17.5rem] rounded-xl border border-default-200 p-0 shadow-lg",
      }}
    >
      <DropdownTrigger>
        <button
          type="button"
          aria-label={`Account menu for ${displayName}`}
          className="ml-0.5 flex size-9 items-center justify-center rounded-full transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background data-[open=true]:ring-2 data-[open=true]:ring-primary-300"
        >
          <UserAvatar
            size="sm"
            src={user.profilePicture}
            name={initial}
            classNames={{ base: "shrink-0", name: "text-xs font-semibold" }}
          />
        </button>
      </DropdownTrigger>

      <DropdownMenu
        aria-label="Account"
        variant="light"
        itemClasses={{
          base: "gap-3 rounded-lg px-2.5 py-2",
          title: "text-sm font-medium",
          description: "text-xs text-default-600",
        }}
        onAction={onAction}
      >
        {/* Who you are, and what account it is. Not a menu item: pressing it
            would do nothing, and the menu has nowhere else to say it. */}
        <DropdownSection showDivider>
          <DropdownItem
            key="identity"
            isReadOnly
            hideSelectedIcon
            // The row is a name and an address, not a string, and the menu's
            // type-to-select needs something to type against. Without one the
            // list logs a missing-label warning on every page.
            textValue={`${displayName} ${user.email}`}
            className="cursor-default opacity-100 data-[hover=true]:bg-transparent"
            startContent={
              <UserAvatar
                size="md"
                src={user.profilePicture}
                name={initial}
                classNames={{ base: "shrink-0", name: "text-sm font-semibold" }}
              />
            }
          >
            <div className="min-w-0">
              <p className="truncate font-[family-name:var(--type-editorial)] text-base font-semibold leading-tight tracking-[-0.01em] text-foreground">
                {displayName}
              </p>
              <p className="mt-0.5 truncate text-xs text-default-600">
                {user.email}
              </p>
            </div>
          </DropdownItem>
        </DropdownSection>

        <DropdownSection>
          {links.map((link) => (
            <DropdownItem
              key={link.key}
              description={link.description}
              startContent={
                <span aria-hidden className="text-default-500">
                  {link.icon}
                </span>
              }
            >
              {link.label}
            </DropdownItem>
          ))}
        </DropdownSection>

        <DropdownSection showDivider>
          <DropdownItem
            key="write"
            description="Start a new draft"
            startContent={
              <span aria-hidden className="text-default-500">
                <HiOutlinePencilSquare />
              </span>
            }
          >
            Write a blog
          </DropdownItem>
          <DropdownItem
            key="site"
            href="/"
            description="Open the public feed"
            startContent={
              <span aria-hidden className="text-default-500">
                <HiOutlineArrowTopRightOnSquare />
              </span>
            }
          >
            View the site
          </DropdownItem>
        </DropdownSection>

        <DropdownSection>
          <DropdownItem
            key="logout"
            color="danger"
            description="You can sign back in any time"
            startContent={
              <span aria-hidden>
                <FiLogOut />
              </span>
            }
          >
            Log out
          </DropdownItem>
        </DropdownSection>
      </DropdownMenu>
    </Dropdown>
  );
};

export default NavarDropdown;
