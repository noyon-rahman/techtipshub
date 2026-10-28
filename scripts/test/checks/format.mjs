/**
 * The last check: formatting in the places Prettier cannot reach.
 *
 * Prettier decides layout. What it does not cover is the encoding of the files
 * it rewrites, and this repository has two hard rules about that which have
 * broken before: everything is UTF-8 with no byte-order mark, and no file
 * carries an en or em dash. Both are checked on every tracked text file, and
 * both failures have cost real time: a byte-order mark breaks a JSON parse, and
 * the dashes are the strongest sign of machine-written prose.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".css",
  ".yml",
  ".yaml",
]);

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".turbo",
  "dist",
  "build",
  ".git",
  ".playwright-mcp",
  // Tool-installed skill files and editor state. They are not this
  // repository's prose, and antislop's own documentation is exempt from its
  // dash rule (R-02 carve-out).
  ".agents",
  ".claude",
  ".cursor",
  ".opencode",
  ".commandcode",
  ".vscode",
]);

// `next dev` writes these two files and puts a dash in its own copy, so they
// are excluded rather than fought: the block is regenerated on every run.
const IGNORED_FILES = new Set(["apps/web/AGENTS.md", "CLAUDE.md"]);

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    if (entry.isFile() && TEXT_EXTENSIONS.has(extname(entry.name))) {
      if (!IGNORED_FILES.has(relative(root, full).replaceAll("\\", "/"))) {
        out.push(full);
      }
    }
  }
  return out;
};

const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
const problems = [];

for (const file of walk(root)) {
  const bytes = readFileSync(file);
  const shown = relative(root, file).replaceAll("\\", "/");

  if (bytes.subarray(0, 3).equals(BOM)) {
    problems.push(`${shown}: starts with a UTF-8 byte-order mark`);
    continue;
  }

  const text = bytes.toString("utf8");

  // Round-tripping catches a file that is not UTF-8 at all, which is how a
  // Windows-1252 dash usually arrives.
  if (Buffer.from(text, "utf8").compare(bytes) !== 0) {
    problems.push(`${shown}: is not valid UTF-8`);
    continue;
  }

  text.split("\n").forEach((line, index) => {
    if (/[\u2013\u2014]/.test(line)) {
      problems.push(`${shown}:${index + 1}: contains an en or em dash`);
    }
  });
}

// One Prettier config, at the root. A config inside an app is a second opinion
// about the same file, and the two drift.
const configs = [
  "prettier.config.mjs",
  "prettier.config.js",
  "prettier.config.cjs",
  ".prettierrc",
  ".prettierrc.json",
  ".prettierrc.json5",
  ".prettierrc.yaml",
  ".prettierrc.yml",
  ".prettierrc.toml",
];

for (const app of ["apps/api", "apps/web", "packages"]) {
  const dir = join(root, app);
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir)) {
    if (configs.includes(entry)) {
      problems.push(
        `${app}/${entry}: a second Prettier config; the root one governs`,
      );
    }
  }
}

if (!configs.some((name) => existsSync(join(root, name)))) {
  problems.push("no Prettier config at the repository root");
}

if (problems.length) {
  for (const problem of problems) process.stdout.write(`  ${problem}\n`);
  process.exit(1);
}

process.stdout.write(
  "  every tracked text file is UTF-8, mark free and dash free\n",
);
