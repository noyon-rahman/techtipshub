import UserSidebar from "@/components/shared/user-sidebar";
import type { Metadata } from "next";

interface IProps {
  children: React.ReactNode;
}

/** Every screen under `/profile` belongs to one signed-in member. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Profile shell: a sticky account rail and the content column beside it.
 *
 * The profile page (which is also its editor) and the article list share this
 * frame so moving between them keeps the rail in place. The composer and the
 * article editor live at the site root instead, in the editor's own full-width
 * frame. The site header already comes from `(mainLayout)`. The rail starts
 * where the header does, on the same page width and gutters.
 */
const ProfileLayout: React.FC<IProps> = ({ children }) => (
  <div className="mx-auto flex w-full max-w-page flex-col px-4 sm:px-6 lg:flex-row lg:px-8">
    <UserSidebar />
    <main className="min-w-0 flex-1">
      <div className="py-8 lg:py-12 lg:pl-10">{children}</div>
    </main>
  </div>
);

export default ProfileLayout;
