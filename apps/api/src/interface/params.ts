/**
 * Route params used across the API.
 *
 * Every route here uses single-segment params (`/:id`, `/:slug`,
 * `/:username`, ...), so the value is always a string at runtime. Controllers
 * read `c.req.param()` as this type instead of casting each value.
 */
export type TRouteParams = {
  id: string;
  username: string;
  slug: string;
  userId: string;
  transactionId: string;
};
