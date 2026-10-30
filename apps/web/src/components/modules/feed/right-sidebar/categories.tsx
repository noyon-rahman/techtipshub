import Categories from "./category-list";
import { siteCategories } from "@/lib/site-settings";

/**
 * The feed's Categories card. The list is the same for every reader and comes
 * from the tag-cached site data, so this stays a server component.
 */
const CategoriesCard = async () => {
  const categories = await siteCategories();

  return <Categories categories={categories} />;
};

export default CategoriesCard;
