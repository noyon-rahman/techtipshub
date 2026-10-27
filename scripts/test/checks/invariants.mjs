import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The invariants that only a whole-tree read can check.
 *
 * Every one of these is a rule the repository already follows and that
 * something quietly breaks: a placeholder that ships, a route that forgets its
 * roles, a console log in a production bundle, a Turbo cache key that drifts
 * from the env the API actually reads.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const api = join(root, "apps/api/src");
const web = join(root, "apps/web/src");

const failures = [];
const read = (file) => readFileSync(file, "utf8");

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

const sources = (dir, extensions) =>
  walk(dir).filter((file) =>
    extensions.some((extension) => file.endsWith(extension)),
  );

const fail = (file, line, message) => {
  const shown = relative(root, file).replaceAll("\\", "/");
  failures.push(`${shown}:${line}: ${message}`);
};

const linesOf = (file) => read(file).split("\n");
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);

// 1. No bracketed placeholder ships. DESIGN.md sets the marker as [ALL CAPS],
//    and a marker is never prose.
const placeholder = /\[[A-Z][A-Z0-9 _]{3,}\]/;

for (const file of sources(web, [".ts", ".tsx"])) {
  linesOf(file).forEach((line, index) => {
    if (isComment(line)) return;
    const match = line.match(placeholder);
    if (match) fail(file, index + 1, `ships a placeholder: ${match[0]}`);
  });
}

// A deliberate list of the moments a reader should be told the truth rather
// than left to a silent failure: the error boundary, the ad grid failing to
// load, a copy that did not reach the clipboard, an image that never arrived,
// a page that could not load more. Logging is how the cause reaches a developer.
const REPORTED_FAILURES = new Set([
  "app/error.tsx",
  "lib/reader-session.ts",
  "components/adsense/adsense-slot.tsx",
  "components/blog-document/index.tsx",
  "components/modals/update-blog-modal.tsx",
  "components/modules/feed/index.tsx",
  "components/ui/blog-share-dropdown.tsx",
  "components/ui/profile-share-dropdown.tsx",
]);

// 2. Console use in the web app. The API logs on purpose at boot; the browser
//    console is where a stray debug log reaches a reader. Reporting a real
//    failure is allowed, but only from the files that do it on purpose:
//    a new console call means the list above must say why.
for (const file of sources(web, [".ts", ".tsx"])) {
  const shown = relative(web, file).replaceAll("\\", "/");
  const allowed = REPORTED_FAILURES.has(shown);

  linesOf(file).forEach((line, index) => {
    if (isComment(line)) return;
    const call = line.match(/\bconsole\.(log|info|debug|warn|error|trace)\b/);
    if (!call) return;
    if (!allowed && call[1] !== "error" && call[1] !== "warn") {
      fail(file, index + 1, `console.${call[1]} left in the browser app`);
    }
  });
}

// 3. A client component never names a session cookie: the token is httpOnly and
//    the browser has no business knowing its name.
for (const file of sources(web, [".tsx"])) {
  const text = read(file);
  if (!/["']use client["']/.test(text)) continue;
  if (/tth_(access|refresh)_token/.test(text)) {
    fail(file, 1, "a client component names a session cookie");
  }
}

// 4. Every signed-in route names its roles. A bare auth() admits every account.
for (const file of sources(api, [".routes.ts"])) {
  linesOf(file).forEach((line, index) => {
    if (isComment(line)) return;
    if (/\bauth\(\s*\)/.test(line)) {
      fail(
        file,
        index + 1,
        "auth() with no role admits every signed-in account",
      );
    }
  });
}

// 5. The admin tree is refused for a non-admin in one place.
const adminRoutes = join(api, "modules/admin/admin.routes.ts");
if (!/auth\(USER_ROLE\.ADMIN\)/.test(read(adminRoutes))) {
  fail(
    adminRoutes,
    1,
    "the admin router no longer refuses every non-admin call",
  );
}

// 6. Turbo's cache key lists exactly what the apps read from the environment.
//    A missing key reuses a build from a different configuration; a stale key
//    tells the next reader a variable still matters when nothing reads it.
const envSource = read(join(api, "config/env.ts"));
// The schema's shape, not its indentation: every key at the start of a line
// inside the object literal, whatever depth or line breaks Prettier chose.
const schemaBody = envSource.slice(
  envSource.indexOf("NODE_ENV:"),
  envSource.indexOf(".superRefine("),
);
const declared = new Set(
  [...schemaBody.matchAll(/^\s+([A-Z][A-Z0-9_]+):/gm)].map((match) => match[1]),
);
// Keys read straight from `process.env` instead of through the parsed schema.
// Anything the platform supplies is excluded: it is not ours to cache.
const PLATFORM_ENV = new Set([
  "VERCEL",
  "NEXT_RUNTIME",
  "NEXT_PHASE",
  "NODE_ENV",
]);
for (const match of envSource.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) {
  if (!PLATFORM_ENV.has(match[1])) declared.add(match[1]);
}
const turbo = JSON.parse(read(join(root, "turbo.json")));
const globalEnv = new Set(turbo.globalEnv ?? []);

// Read by the web app or supplied by the platform rather than by the API.
const otherEnv = new Set([
  "NODE_ENV",
  "NEXT_RUNTIME",
  "NEXT_PHASE",
  "VERCEL",
  "BASE_API",
  "NEXT_PUBLIC_BASE_API",
  "SITE_URL",
  "NEXT_PUBLIC_CONTACT_EMAIL",
  "NEXT_PUBLIC_ADSENSE_ENABLED",
]);

for (const name of declared) {
  if (!globalEnv.has(name)) {
    failures.push(
      `turbo.json: globalEnv is missing ${name}, which the API reads`,
    );
  }
}

for (const name of globalEnv) {
  if (!declared.has(name) && !otherEnv.has(name)) {
    failures.push(`turbo.json: globalEnv lists ${name}, which nothing reads`);
  }
}

// 7. One source of truth for the public contact address: it is either the
//    env var or the fallback in config/legal.ts, never a second literal.
const legal = read(join(web, "config/legal.ts"));
const contact = legal.match(/contactEmail:[\s\S]*?"([^"]+@[^"]+)"/);
if (contact) {
  const address = contact[1];
  for (const file of sources(web, [".ts", ".tsx"])) {
    if (file === join(web, "config/legal.ts")) continue;
    read(file)
      .split("\n")
      .forEach((line, index) => {
        if (line.includes(address)) {
          fail(
            file,
            index + 1,
            `repeats the contact address; use legalConfig.contactEmail`,
          );
        }
      });
  }
}

if (failures.length) {
  for (const failure of failures) process.stdout.write(`  ${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  "  no placeholders, roles named, no browser console, env keys agree\n",
);
