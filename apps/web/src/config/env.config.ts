import { baseApi } from "@/config/api";

const envConfig = {
  baseApi,
  NODE_ENV: process.env.NODE_ENV,
  /** The site's own origin. Used to scope the session cookies it writes. */
  siteUrl: (process.env.SITE_URL || "http://localhost:3000").replace(/\/$/, ""),
};

export default envConfig;
