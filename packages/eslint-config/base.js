import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";

/**
 * Settings every package in the monorepo shares: the JS baseline, the
 * typescript-eslint recommended set, and the formatting rules turned off so
 * Prettier owns them.
 *
 * `languageOptions.globals` is deliberately left to each package. ESLint's
 * `no-undef` only knows the names listed there, and a Node service and a
 * browser app need different ones.
 */
export const base = [
  js.configs.recommended,
  ...tsPlugin.configs["flat/recommended"],
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-unused-expressions": "error",
      "prefer-const": "error",
    },
  },
  prettier,
];

export default base;
