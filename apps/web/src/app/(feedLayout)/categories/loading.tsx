/**
 * Route fallback for `/categories`: the heading and the rows at the height the
 * real list lands at, so the page does not jump when it arrives. Each skeleton
 * row carries the count line and the bar, the two things the real row draws.
 */
const CategoriesLoading = () => (
  <div aria-busy="true" aria-label="Loading categories">
    <div className="border-b border-default/60 pb-5">
      <div className="h-8 w-40 rounded-md bg-default-200" />
      <div className="mt-3 h-4 w-full max-w-md rounded-md bg-default-100" />
    </div>
    <ul className="-mx-3 mt-3 divide-y divide-default/50">
      {Array.from({ length: 10 }).map((_, index) => (
        <li key={index} className="px-3 py-3">
          <div className="grid grid-cols-[1fr_auto] items-center gap-x-4">
            <div className="h-4 w-32 rounded bg-default-100" />
            <div className="h-3 w-20 rounded bg-default-100" />
          </div>
          <div className="mt-2 h-[3px] w-full rounded-full bg-default-100" />
        </li>
      ))}
    </ul>
  </div>
);

export default CategoriesLoading;
