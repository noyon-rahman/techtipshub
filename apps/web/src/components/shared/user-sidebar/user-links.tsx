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
 * The rail's links. The profile page is the member's own, so it needs no handle
 * from the visitor; the list entry beside it is the account's articles.
 */
export const userLinks: ILink[] = [
  {
    id: "01",
    label: "Profile",
    href: ownProfilePath,
    description: "Your name, photo, bio, links and reading topics",
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
