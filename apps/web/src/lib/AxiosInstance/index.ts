import envConfig from "@/config/env.config";
import { legacyBody } from "@/lib/api-contract";
import { getAccessToken } from "@/lib/fetch-with-auth";
import axios from "axios";

/**
 * A client build must never pull an API URL out of the environment: in the
 * browser `/api/v1` is this app's own handler for the calls a member makes
 * (see `src/app/api/v1/[...path]/route.ts`), which forwards them to the API
 * with the session attached. A direct address would skip that handler and the
 * httpOnly cookie with it. Snapshots that run on the server keep using the
 * configured base.
 */
const serverBaseApi =
  typeof process === "undefined" || typeof window !== "undefined"
    ? "/api/v1"
    : (envConfig.baseApi ?? "/api/v1");

const axiosInstance = axios.create({
  baseURL: serverBaseApi,
  withCredentials: true,
});

/**
 * Where an admin call goes once it leaves the browser.
 *
 * Admin screens render on the client, where `getAccessToken` cannot read the
 * httpOnly session cookie. Those calls go to this app's own
 * `/api/admin/...` handler instead, which forwards them to the API's
 * `/api/v1/admin/...` with the token attached. While rendering on the server
 * the token is readable, so the API is called directly.
 */
const clientAdminBase = "/api/admin";
const ADMIN_MARKER = "/admin";
const isServer = typeof window === "undefined";

// Add a request interceptor
//
// The token is already valid by the time a request leaves the app: the proxy
// renews an expired access token at the request boundary, where cookies can be
// written. This only reads it.
axiosInstance.interceptors.request.use(
  async function (config) {
    if (!isServer) {
      const path = config.url?.split("?")[0] ?? "";
      if (path === ADMIN_MARKER || path.startsWith(`${ADMIN_MARKER}/`)) {
        config.baseURL = clientAdminBase;
        config.url = config.url!.slice(ADMIN_MARKER.length) || "/";
        return config;
      }
    }

    const accessToken = await getAccessToken();

    if (accessToken) {
      config.headers["Authorization"] = `Bearer ${accessToken}`;
    }

    return config;
  },
  function (error) {
    return Promise.reject(error);
  },
);

// Add a response interceptor
//
// The API answers `{ data, meta? }` on success and `{ error: { message, code?,
// details? } }` on failure. The screens were written against the older
// `{ success, data, meta, message }` body, so each answer is translated back to
// that shape here instead of at every call site. Errors are translated but
// still rejected, which is how callers already handle a failed request.
axiosInstance.interceptors.response.use(
  function (response) {
    response.data = legacyBody(response.data, true, undefined, response.status);
    return response;
  },
  function (error) {
    // 401s are handled before they are sent (see the request interceptor), so
    // there is nothing to retry here; callers get the API's own answer.
    if (error?.response) {
      error.response.data = legacyBody(
        error.response.data,
        false,
        error.response.statusText || "Something went wrong.",
        error.response.status,
      );
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
