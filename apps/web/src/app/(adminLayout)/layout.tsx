import type { Metadata } from "next";
import Link from "next/link";
import AdminSidebar from "@/components/shared/admin-sidebar";
import { AdminShellProvider } from "@/components/shared/admin-sidebar/admin-shell";
import { AdminRailFrame } from "@/components/shared/admin-sidebar/admin-rail-frame";
import AdminTopbar from "@/components/shared/admin-sidebar/admin-topbar";

export const metadata: Metadata = {
  title: {
    default: "Admin",
    template: "%s | Admin | TechTipsHub",
  },
  description:
    "Admin panel for TechTipsHub: articles, comments, members, messages and site settings.",
  robots: { index: false, follow: false },
};

/**
 * Admin shell. Rendered on the server; only the rail, the drawer and the top
 * bar hydrate.
 *
 * The rail is painted out of the flow (`fixed`, own full viewport height). The
 * `AdminRailFrame` wrapper reserves the rail's width on the content column, so
 * the rail cannot drift while the page scrolls and it never depends on the
 * height of its parent. A sticky rail would still be at the mercy of every
 * ancestor above it: any wrapper that gains a scroll container or a height cap,
 * including the AdSense script that stamps styles on layout ancestors, parks it
 * at the top of the document. The rail body scrolls its own nav when the
 * viewport is short.
 *
 * The page keeps the site's warm paper; the white belongs to the cards on it.
 * Panels, stat tiles and toolbar fields take `content1`, which is white in the
 * light theme and the raised charcoal step in the dark one, so each one reads
 * as a sheet lying on the page.
 *
 * Pages keep their own spacing between blocks. The frame only sets the
 * width, the top air and the bottom room, so a page can never render wider
 * than `max-w-page` or flush against the bar.
 *
 * The column is at least a viewport tall, which is what puts the sign-off
 * footer on the fold of a short page: `main` grows to fill, so the rule lands
 * at the same height on every screen no matter how much content sits above
 * it. Without it the footer floats up under the last card on some pages and
 * off the bottom on others. When the content is taller than the viewport the
 * footer follows it down, the way a normal document ends.
 */
const AdminLayout = ({ children }: { children: React.ReactNode }) => {
  return (
    <AdminShellProvider>
      <AdminRailFrame>
        <a
          href="#admin-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-[6px] focus:bg-foreground focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-background"
        >
          Skip to admin content
        </a>

        <AdminSidebar />

        <div className="flex min-h-dvh min-w-0 flex-col lg:p-2 lg:pl-0">
          <div className="flex min-h-dvh min-w-0 flex-1 flex-col overflow-x-clip bg-background lg:min-h-[calc(100dvh-1rem)] lg:rounded-2xl lg:border lg:border-default/60 lg:shadow-[0_1px_3px_rgba(20,19,21,0.05)] dark:lg:shadow-none">
            <AdminTopbar />

            <main
              id="admin-content"
              tabIndex={-1}
              className="w-full min-w-0 flex-1 px-4 pb-14 pt-5 focus:outline-none sm:px-6 lg:px-7 lg:pt-6"
            >
              <div className="w-full min-w-0">{children}</div>
            </main>

            <footer className="border-t border-default/60 px-4 py-3.5 sm:px-6 lg:px-7">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-default-600">
                <span>TechTipsHub admin</span>
                <span>
                  Every change is recorded in the{" "}
                  <Link
                    href="/admin/activity-log"
                    className="rounded-sm underline decoration-default-300 underline-offset-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    activity log
                  </Link>
                  .
                </span>
              </div>
            </footer>
          </div>
        </div>
      </AdminRailFrame>
    </AdminShellProvider>
  );
};

export default AdminLayout;
