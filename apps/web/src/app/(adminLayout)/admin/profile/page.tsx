import AdminPageHeader from "@/components/modules/admin/kit/page-header";
import SectionCard from "@/components/modules/admin/section-card";
import ProfileArticleList from "@/components/modules/profile/profile-article-list";
import ProfileHeader from "@/components/modules/profile/profile-header";
import ProfileOwnPage from "@/components/modules/profile/profile-own";
import ButtonLink from "@/components/ui/button-link";
import ProfileShareDropdown from "@/components/ui/profile-share-dropdown";
import { publicProfilePath } from "@/lib/blog-routes";
import { getProfileInfo } from "@/services/auth";
import { getBlogsByUserId } from "@/services/blog";
import type { IBlog, IUser } from "@/types";
import type { Metadata } from "next";
import { BiSupport } from "react-icons/bi";

const PROFILE_PAGE_SIZE = 8;

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your admin profile, account settings and articles.",
};

/**
 * Dedicated admin profile page (`/admin/profile`).
 *
 * Keeps the admin inside the admin shell while reusing the live profile
 * header, inline editor (`ProfileOwnPage`), account switches and article list.
 */
const AdminProfilePage = async () => {
  const profileData = await getProfileInfo().catch(() => null);
  const user = (profileData?.data as IUser) ?? undefined;

  if (!profileData?.success || !user?._id) {
    return (
      <div>
        <AdminPageHeader
          title="Your profile"
          description="Manage your admin identity, handle, account preferences and published articles."
        />
        <div className="rounded-xl border border-default/60 bg-content-1 px-6 py-12 text-center">
          <h2 className="font-[family-name:var(--type-editorial)] text-lg font-semibold tracking-[-0.015em]">
            We could not load your profile
          </h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-default-600">
            {profileData?.message ||
              "Something went wrong while loading your account. Try again in a moment."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/login" radius="lg" color="primary">
              Sign in again
            </ButtonLink>
            <ButtonLink
              href="/contact"
              radius="lg"
              variant="bordered"
              startContent={<BiSupport />}
            >
              Contact support
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  const blogsData = await getBlogsByUserId(user._id, {
    limit: String(PROFILE_PAGE_SIZE),
    page: "1",
  }).catch(() => null);

  const blogs = Array.isArray(blogsData?.data)
    ? (blogsData.data as IBlog[])
    : [];
  const totalBlogs = Number.isFinite(Number(blogsData?.meta?.total))
    ? Number(blogsData?.meta?.total)
    : blogs.length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Your profile"
        description="Manage your admin identity, handle, account preferences and published articles."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink
              href="/admin/manage-blogs"
              radius="lg"
              variant="bordered"
            >
              Manage articles
            </ButtonLink>
            <ButtonLink
              href="/admin/manage-blogs/new"
              radius="lg"
              color="primary"
            >
              Write article
            </ButtonLink>
            <ProfileShareDropdown
              profileUrl={publicProfilePath(user.username)}
            />
          </div>
        }
      />

      <div className="rounded-xl border border-default/60 bg-content-1 p-5 sm:p-6">
        <ProfileHeader user={user} blogCount={totalBlogs} />
        <ProfileOwnPage key={user.updatedAt ?? "profile"} user={user} />
      </div>

      <SectionCard
        title="Your articles"
        description={
          totalBlogs === 0
            ? "Nothing published yet."
            : `${totalBlogs.toLocaleString()} published, newest first.`
        }
        action={
          totalBlogs === 0 ? (
            <ButtonLink
              href="/admin/manage-blogs/new"
              size="sm"
              radius="lg"
              color="primary"
            >
              Start writing
            </ButtonLink>
          ) : undefined
        }
      >
        <ProfileArticleList
          userId={user._id}
          initialBlogs={blogs}
          total={totalBlogs}
          emptyMessage="You have not published anything yet. Your first article starts here."
        />
      </SectionCard>
    </div>
  );
};

export default AdminProfilePage;

