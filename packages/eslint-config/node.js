import { base } from "./base.js";

/**
 * Shared globals for code that runs on Node. Listing them by hand rather than
 * pulling `globals` keeps the rule that `no-undef` only accepts what is
 * declared here, so a stray browser global is caught instead of assumed.
 */
export const nodeGlobals = {
  process: "readonly",
  console: "readonly",
  Buffer: "readonly",
  File: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  __dirname: "readonly",
  __filename: "readonly",
  fetch: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  Request: "readonly",
  Response: "readonly",
  Headers: "readonly",
  AbortController: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
};

/**
 * For a Node service: the base set plus Node globals, and `no-undef` on so an
 * undeclared global fails the build instead of reaching production.
 */
export const node = [
  ...base,
  {
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    languageOptions: {
      globals: nodeGlobals,
    },
    rules: {
      "no-console": "warn",
      "no-undef": "error",
    },
  },
];

export default node;
