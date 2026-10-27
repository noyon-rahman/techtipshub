import ManageBlogs from "@/components/modules/settings/manage-blogs";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "My articles",
  description:
    "Everything you have published on TechTipsHub, ready to edit or remove.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/profile/blogs" },
};

interface IProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    sort?: string;
  }>;
}

/**
 * The account's article list, in the same rail and column as settings.
 */
const MyArticlesPage = ({ searchParams }: IProps) => (
  <ManageBlogs searchParams={searchParams} />
);

export default MyArticlesPage;
