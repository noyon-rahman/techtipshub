/**
 * Route fallback for `/categories`: the heading and a row of chips at the
 * height the real list lands at, so the page does not jump when it arrives.
 */
const CategoriesLoading = () => (
  <div aria-busy="true" aria-label="Loading categories">
    <div className="border-b border-default/60 pb-5">
      <div className="h-7 w-40 rounded-md bg-default-200" />
      <div className="mt-3 h-4 w-full max-w-sm rounded-md bg-default-100" />
    </div>
    <div className="mt-5 flex flex-wrap gap-2">
      {Array.from({ length: 10 }).map((_, index) => (
        <div key={index} className="h-8 w-24 rounded-full bg-default-100" />
      ))}
    </div>
  </div>
);

export default CategoriesLoading;
