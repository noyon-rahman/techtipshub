/**
 * The API origin the browser talks to.
 *
 * Public, so the proxy at the edge can read it too. `NEXT_PUBLIC_BASE_API` and
 * `BASE_API` must hold the same value; the fallback only fires if one is left
 * out of the environment.
 */
export const baseApi = (
  process.env.NEXT_PUBLIC_BASE_API ||
  process.env.BASE_API ||
  "http://localhost:5000/api/v1"
).replace(/\/$/, "");
