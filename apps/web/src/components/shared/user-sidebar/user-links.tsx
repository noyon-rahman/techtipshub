import { manageBlogsPath, ownProfilePath } from "@/lib/blog-routes";
import { ReactNode } from "react";
import { HiOutlineUserCircle } from "react-icons/hi2";
import { MdOutlineArticle } from "react-icons/md";

interface ILink {
  id: string;
  label: string;
  href: string;
  description: string;
  icon: ReactNode;
}

/**
 * The rail's links. The first one points at the member's own profile, so it is
 * built per visitor rather than declared as a constant.
 */
export const userLinks = (username?: string | null): ILink[] => [
  {
    id: "01",
    label: "Profile",
    href: username ? ownProfilePath(username) : "/profile",
    description: "Name, photo, bio and social links",
    icon: <HiOutlineUserCircle size={18} />,
  },
  {
    id: "02",
    label: "My articles",
    href: manageBlogsPath,
    description: "Edit or delete your published blogs",
    icon: <MdOutlineArticle size={18} />,
  },
];
