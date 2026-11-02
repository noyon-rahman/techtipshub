import Footer from "@/components/shared/footer";
import { Navbar } from "@/components/shared/navbar";
import type { Metadata } from "next";

/**
 * The welcome step's frame.
 *
 * The site's own header and footer, unchanged: a member who has just signed in
 * should recognise the page as TechTips Hub and not as a separate product. The
 * header is how they get out if they change their mind, so it stays live.
 *
 * The step itself keeps one column at the reading measure, the same left edge
 * every other screen aligns to, rather than a centred card of its own.
 */
export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false, follow: false },
};

const WelcomeLayout = ({ children }: { children: React.ReactNode }) => (
  <>
    <Navbar />
    <main>{children}</main>
    <Footer />
  </>
);

export default WelcomeLayout;
