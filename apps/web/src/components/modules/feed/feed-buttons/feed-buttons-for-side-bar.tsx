"use client";

import { useUser } from "@/context/user.provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PiListBulletsLight, PiMagicWandLight, PiUsers } from "react-icons/pi";
import { visibleFeedTabs } from "../feed-tabs";

/**
 * One icon per name, and each one says what the words say: a list for
 * everything published, a wand for the order built from the reader's topics,
 * people for the writers they follow. Keyed by the label the tab carries, so a
 * name and its icon cannot drift apart.
 */
const icons: Record<string, React.ReactNode> = {
  All: <PiListBulletsLight className="text-lg" />,
  Personalized: <PiMagicWandLight className="text-lg" />,
  Following: <PiUsers className="text-lg" />,
};

/**
 * The feeds in the left rail, from the same list the phone row reads.
 *
 * `Personalized` and `Following` are built from the reader's account, so they
 * are not drawn until a session exists rather than shown disabled. The rail is
 * a navigation list, so these use the same row treatment as `Explore` below it.
 */
const FeedButtonsForSideBar = () => {
  const { user: loggedInUser } = useUser();
  const pathname = usePathname();
  const active = visibleFeedTabs(Boolean(loggedInUser));

  return (
    <>
      {active.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary/10 text-primary-accessible"
                : "text-default-700 hover:bg-default-100 hover:text-foreground"
            }`}
          >
            <span aria-hidden className="shrink-0">
              {icons[tab.label]}
            </span>
            {tab.label}
          </Link>
        );
      })}
    </>
  );
};

export default FeedButtonsForSideBar;
