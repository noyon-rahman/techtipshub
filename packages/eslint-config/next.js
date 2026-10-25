import nextConfig from "eslint-config-next/core-web-vitals";
import tsPlugin from "@typescript-eslint/eslint-plugin";

/**
 * For a Next.js app: Next's own recommended set is the whole rule set here,
 * since it already brings in the TypeScript parser and React rules.
 *
 * `react-hooks` v7 (shipped by eslint-config-next 16) flags pre-existing
 * patterns such as setState inside an effect. They stay warnings so the build
 * is not blocked while that cleanup happens.
 */
export const next = [
  ...nextConfig,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "@typescript-eslint": tsPlugin },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          ignoreRestSiblings: false,
          argsIgnorePattern: "^_.*?$",
        },
      ],
    },
  },
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
];

export default next;
