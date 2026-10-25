import EditBlog from "@/components/modules/edit-blog";
import ButtonLink from "@/components/ui/button-link";
import { adminManageBlogsPath } from "@/lib/blog-routes";
import { getAdminBlog } from "@/services/admin/blogs";
import { IBlog } from "@/types";
import type { Metadata } from "next";
import Link from "next/link";
import { FiArrowLeft } from "react-icons/fi";

export const metadata: Metadata = {
  title: "Edit article",
  robots: { index: false, follow: false },
};

interface IProps {
  params: Promise<{ id: string }>;
}

/**
 * The admin article editor, inside the admin shell.
 *
 * It is keyed by the article id rather than its slug, so retitling the piece
 * does not change the address the admin is working at. The editor's own bar
 * and publishing rail are offset under the admin top bar rather than the site
 * header.
 */
const AdminEditArticle = async ({ params }: IProps) => {
  const { id } = await params;
  const data = await getAdminBlog(id).catch(() => null);
  const blog = (data?.data as IBlog) ?? undefined;

  if (!blog?._id) {
    return (
      <div className="mx-auto w-full max-w-read space-y-4">
        <Link
          href={adminManageBlogsPath}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-default-600 transition-colors hover:text-foreground"
        >
          <FiArrowLeft aria-hidden className="size-3.5" />
          All articles
        </Link>

        <div className="rounded-xl border border-default/60 bg-default-50/60 px-5 py-6 dark:bg-default-100/5">
          <h1 className="font-[family-name:var(--type-editorial)] text-xl font-semibold tracking-[-0.015em]">
            Article not found
          </h1>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-default-600">
            This article does not exist, or it is in the trash. Restore it from
            Trash before editing.
          </p>
          <div className="mt-4">
            <ButtonLink href={adminManageBlogsPath} size="sm">
              Back to articles
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="-mt-6 lg:-mt-8">
      <EditBlog blog={blog} adminMode />
    </div>
  );
};

export default AdminEditArticle;
