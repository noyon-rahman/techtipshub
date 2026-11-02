"use client";

import { useUser } from "@/context/user.provider";
import { Button } from "@heroui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PiListBulletsLight, PiMagicWandLight, PiUsers } from "react-icons/pi";
import { visibleFeedTabs } from "../feed-tabs";

/**
 * The same icons the rail uses, keyed by the label the tab carries: a list for
 * everything published, a wand for the order built from the reader's topics,
 * people for the writers they follow.
 */
const icons: Record<string, React.ReactNode> = {
  All: <PiListBulletsLight className="text-lg" />,
  Personalized: <PiMagicWandLight className="text-lg" />,
  Following: <PiUsers className="text-lg" />,
};

/**
 * Three tabs have to share the row with Categories on a 390px phone, so the
 * bar scrolls sideways instead of wrapping onto a second line.
 */
const itemClass = (active: boolean) => {
  const base = "shrink-0 px-2 font-medium transition-colors min-[420px]:px-3";

  return active
    ? `${base} bg-primary-100 text-foreground hover:bg-primary-200 dark:bg-primary-200/20 dark:hover:bg-primary-200/30`
    : `${base} bg-transparent text-default-600 hover:bg-default-100 hover:text-foreground`;
};

/**
 * The feed switch, for the widths where the rail is hidden.
 *
 * The same three tabs the rail lists, from one source: `Personalized` and
 * `Following` are built from the reader's account, so they are not drawn until
 * a session exists. Signed out the row holds `All` and `Categories` only, which
 * are the two things a visitor can actually open.
 */
const FeedButtons = () => {
  const { user: loggedInUser } = useUser();
  const pathname = usePathname();
  const tabs = visibleFeedTabs(Boolean(loggedInUser));

  return (
    <>
      {tabs.map((tab) => (
        <Button
          key={tab.href}
          as={Link}
          className={itemClass(pathname === tab.href)}
          href={tab.href}
          radius="full"
          startContent={icons[tab.label]}
        >
          <span className="hidden min-[420px]:inline">{tab.label}</span>
          <span className="sr-only min-[420px]:hidden">{tab.label}</span>
        </Button>
      ))}
    </>
  );
};

export default FeedButtons;
