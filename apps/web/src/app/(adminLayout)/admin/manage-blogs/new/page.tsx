import AdminComposer from "@/components/admin/admin-composer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "New article",
  robots: { index: false, follow: false },
};

/**
 * The admin composer, inside the admin shell.
 *
 * Where an admin writes an article for a member: the author is chosen in the
 * publishing rail, and the piece is saved as a draft in that author's account
 * or published straight away. The member composer at `/blogs/new` is untouched,
 * so nothing here can change how a member writes.
 *
 * The container pulls up under the admin page's own padding, the same way the
 * admin edit page does, because the editor brings its own full-width bar.
 */
const AdminNewArticle = () => (
  <div className="-mt-6 lg:-mt-8">
    <AdminComposer />
  </div>
);

export default AdminNewArticle;
