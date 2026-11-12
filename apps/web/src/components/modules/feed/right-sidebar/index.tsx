import MiniFooter from "@/components/shared/mini-footer";
import NewsletterSignup from "@/components/modules/newsletter/newsletter-signup";
import CategoriesCard from "./categories";
import { AdSlot } from "@/components/adsense";

/**
 * The feed's right rail.
 *
 * Every card here fetches its own data on the server, so nothing waits on
 * anything else and a slow category list cannot hold up the signup form. The ad
 * unit, the footer inside it and the newsletter signup are the client parts.
 */
const RightSideBar = () => {
  return (
    <aside className="tth-rail hidden w-72 shrink-0 xl:block">
      <div className="tth-rail-inner flex flex-col gap-5 px-4 py-5">
        <div className="shrink-0">
          <CategoriesCard />
        </div>

        <div className="shrink-0">
          <NewsletterSignup
            layout="stack"
            className="rounded-xl border border-default/50 p-5"
            title="The monthly roundup"
            description="One email a month with the articles worth your time."
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4">
          <MiniFooter />
          {/* Sidebar ad unit, kept last so it sits below the categories. */}
          <div className="tth-rail-ad">
            <AdSlot
              placement="right-rail"
              className="mt-0 rounded-[10px] border border-default/60 bg-default-50/30 px-3 pb-2"
            />
          </div>
        </div>
      </div>
    </aside>
  );
};

export default RightSideBar;
