import { node } from "@techtipshub/eslint-config/node";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "email-templates/**", "*.js", "*.cjs"],
  },
  ...node,
  {
    files: ["src/**/*.ts"],
    rules: {
      // The API is the only place a bare `console` call is acceptable; the
      // shared profile keeps it a warning everywhere else.
      "no-console": "warn",
    },
  },
];
