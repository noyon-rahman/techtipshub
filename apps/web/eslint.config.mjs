import { next } from "@techtipshub/eslint-config/next";

export default [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "dist/**",
      "next-env.d.ts",
      "*.config.js",
      "next-sitemap*.js",
    ],
  },
  ...next,
];
