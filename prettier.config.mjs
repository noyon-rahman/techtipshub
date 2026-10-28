// Shared Prettier settings for every package in the workspace. The API's own
// `singleQuote: false` used to live in apps/api/.prettierrc.json; it applies to
// the whole repo now, so the two apps format the same way.
//
// Nothing here changes layout decisions that were made by hand: these are the
// only settings Prettier is allowed to make. See scripts/test/checks/format.mjs
// for the part this file cannot enforce.
export default {
  semi: true,
  singleQuote: false,
  tabWidth: 2,
  printWidth: 80,
  trailingComma: "all",
};
