import { spawnSync } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * The filter contract of `QueryBuilder.filter()`, run rather than read.
 *
 * Visibility columns are decided by the route, never by the caller: a request
 * carrying `?status=draft` or `?isDeleted=true` used to put unpublished or
 * trashed rows on a feed. So the builder drops both keys unless the list opts
 * in, and only the admin lists that have checked the value opt in to `status`.
 *
 * The behaviour half imports the real builder, models and constants from
 * `apps/api` through the tsx the app already depends on, and reads back the
 * filter each query would send. Mongoose only opens a connection when a query
 * is executed, and nothing here executes one, so no database is needed.
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const api = join(root, "apps/api");
const src = join(api, "src");
const builderFile = join(src, "builder/QueryBuilder.ts");
const asPosix = (path) => path.replaceAll("\\", "/");
const shown = (file) => asPosix(relative(root, file));
const shownBuilder = shown(builderFile);

const failures = [];
const read = (file) => readFileSync(file, "utf8");
const isComment = (line) => /^\s*(\/\/|\*|\/\*)/.test(line);
const fail = (file, line, message) => {
  failures.push(`${shown(file)}:${line}: ${message}`);
};

const walk = (dir, out = []) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

// A request the builder is handed: the value an admin tab sends, a visibility
// column a caller is never allowed to decide, and an ordinary key.
const QUERY = { status: "active", isDeleted: "true", role: "Admin" };

/**
 * The probe. It runs inside `tsx`, which is what resolves the extensionless
 * imports between the sources, and returns its result through a file: the code
 * of `tsx -e` runs inside a wrapper, so a pipe cannot be trusted with it.
 */
const PROBE = `
const out = process.env.QUERY_FILTER_OUT;
const src = process.cwd() + "/src/";
const write = (text) => require("node:fs").writeFileSync(out, text);
const load = (path) =>
  import(require("node:url").pathToFileURL(src + path).href);

// tsx compiles the sources to CommonJS (the app has no "type": "module"), so a
// class or model arrives under two "default"s: the namespace, then the export.
const unwrap = (module) =>
  module.default && module.default.default
    ? module.default.default
    : module.default;

(async () => {
  const loadDefault = async (path) => unwrap(await load(path));

  const Builder = await loadDefault("builder/QueryBuilder.ts");
  const Subscriber = await loadDefault(
    "modules/newsletter/newsletter.model.ts",
  );
  const Post = await loadDefault("modules/blog/blog.model.ts");
  const { LIVE_ARTICLE } = await load("modules/blog/blog.constant.ts");

  const request = ${JSON.stringify(QUERY)};

  // .find() builds a query without running it, and getFilter() shows the
  // filter that query would send.
  const filterOf = async (Model, options) => {
    const builder = new Builder(Model.find({}), { ...request }, options);
    await builder.filter();
    return builder.modelQuery.getFilter();
  };

  // filter() leaves { $and: [base, requestKeys] }. The base half holds
  // isDeleted on purpose (LIVE_ARTICLE), so the request half is the one that
  // says whether the caller's key survived.
  const requestHalf = (filter) =>
    Array.isArray(filter.$and) ? filter.$and[1] : {};

  // The blog query starts from LIVE_ARTICLE the way the blog list does, so the
  // base half is a known object to look for.
  const blog = new Builder(Post.find({ ...LIVE_ARTICLE }), { ...request });
  await blog.filter();

  write(
    "PROBE " +
      JSON.stringify({
        liveArticle: LIVE_ARTICLE,
        plain: requestHalf(await filterOf(Subscriber)),
        opted: requestHalf(
          await filterOf(Subscriber, { allowVisibilityFilters: ["status"] }),
        ),
        stray: requestHalf(
          await filterOf(Subscriber, {
            allowVisibilityFilters: ["status", "isDeleted", "role"],
          }),
        ),
        under: requestHalf(
          await filterOf(Subscriber, {
            allowVisibilityFilters: ["spam", "isDeleted"],
          }),
        ),
        blog: blog.modelQuery.getFilter(),
      }),
  );
})().catch((error) => {
  write("PROBE " + error.stack);
});
`;

/**
 * Runs the probe and returns what it reported, or records why it could not.
 */
const runProbe = () => {
  const tsx = createRequire(join(api, "package.json")).resolve("tsx/cli");
  const stem = join(tmpdir(), `query-filter-${process.pid}`);
  const script = `${stem}.ts`;
  const out = `${stem}.json`;

  writeFileSync(script, PROBE);

  try {
    spawnSync(process.execPath, [tsx, script], {
      cwd: api,
      encoding: "utf8",
      env: { ...process.env, QUERY_FILTER_OUT: out },
    });

    const written = existsSync(out) ? read(out) : "";
    const payload = written.startsWith("PROBE ")
      ? written.slice("PROBE ".length)
      : "";

    if (!payload.startsWith("{")) {
      const reason = payload.split("\n")[0] || "no result";
      failures.push(`${shownBuilder}: the builder could not be run: ${reason}`);
      return undefined;
    }

    return JSON.parse(payload);
  } finally {
    rmSync(script, { force: true });
    rmSync(out, { force: true });
  }
};

const has = (half, key) =>
  Object.prototype.hasOwnProperty.call(half ?? {}, key);
const sameObject = (left, right) =>
  left !== undefined && JSON.stringify(left) === JSON.stringify(right);

// 1. The guard, the opt-in and the base filter, all from the real code.
const behaviour = runProbe();

if (behaviour) {
  const { plain, opted, stray, under, blog, liveArticle } = behaviour;

  // Without options a public list keeps neither column, while an ordinary key
  // still passes: the guard removes what it knows, not the whole request.
  if (has(plain, "status") || has(plain, "isDeleted")) {
    failures.push(
      `${shownBuilder}: a builder with no options kept a visibility column, so a caller decides what a list shows`,
    );
  } else if (plain.role !== "Admin") {
    failures.push(
      `${shownBuilder}: a builder with no options dropped an ordinary key, so the guard reaches past the visibility columns`,
    );
  }

  // With the option the checked value reaches the filter, and nothing else
  // does, including a key the guard does not know.
  if (opted.status !== "active" || has(opted, "isDeleted")) {
    failures.push(
      `${shownBuilder}: an opt-in did not keep exactly the checked status`,
    );
  }

  // A list that names an unknown key too still keeps the checked status. The
  // unknown key itself is the caller's; whether it leaks is a separate
  // decision, so it is not asserted here.
  if (stray.status !== "active") {
    failures.push(
      `${shownBuilder}: an allow list that names an unknown key lost the checked status`,
    );
  }

  // A list that names only isDeleted and unknown keys has not opted in to
  // status, so a request cannot smuggle status through a stray entry.
  if (has(under, "status")) {
    failures.push(
      `${shownBuilder}: an allow list of unknown keys still decided status`,
    );
  }

  // The base filter is folded back in, unchanged, so a request cannot drop the
  // model's own defaults and unmask a draft or a trashed row.
  const halves = Array.isArray(blog.$and) ? blog.$and : [];
  if (!halves.some((half) => sameObject(half, liveArticle))) {
    failures.push(
      `${shownBuilder}: the base filter is missing from the $and, so a request can unmask drafts`,
    );
  }
}

// 2. Which lists opt in, read rather than called: the services reach models,
//    mail and env, none of which belong in a gate.
const ADMIN_LISTS = [
  "modules/newsletter/newsletter-admin.service.ts",
  "modules/contact/contact.service.ts",
  "modules/user/user.service.ts",
];

// The optional third argument is the only place the option is passed, so the
// constructor call is the whole surface to read. A comment saying a list opts
// in is prose, not an opt-in, so block comments go first and line comments are
// dropped line by line.
const OPT_IN = /allowVisibilityFilters\s*:\s*\[\s*"status"\s*\]/;

const optedIn = new Set();

for (const path of ADMIN_LISTS) {
  const file = join(src, path);
  const lines = read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n");

  lines.forEach((line, index) => {
    if (isComment(line)) return;
    if (OPT_IN.test(line)) optedIn.add(path);
  });

  if (!optedIn.has(path)) {
    fail(
      file,
      1,
      'an admin list no longer opts in to "status", so its tabs filter nothing',
    );
  }
}

// Every other mention of the option in the tree names a key nobody decided
// (isDeleted), a key the guard does not know, or a list that is not an admin
// list.
const OPT_IN_KEYS = /allowVisibilityFilters\s*:\s*\[([^\]]*)\]/g;
const OPTION_MENTION = /allowVisibilityFilters/;

for (const file of walk(src).filter((entry) => entry.endsWith(".ts"))) {
  if (file === builderFile) continue;
  const lines = read(file)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n");

  lines.forEach((line, index) => {
    if (isComment(line)) return;
    if (!OPTION_MENTION.test(line)) return;

    const keys = [...line.matchAll(OPT_IN_KEYS)];

    // A name passed in a variable would slip past the key check below.
    if (keys.length === 0) {
      fail(
        file,
        index + 1,
        "the option is passed outside a literal list, so the guard cannot see what it allows",
      );
      return;
    }

    for (const [, names] of keys) {
      const compact = names.replace(/\s+/g, "");

      if (/"isDeleted"/.test(compact)) {
        fail(file, index + 1, "isDeleted is opted in; no list decides it");
      } else if (compact !== '"status"') {
        fail(
          file,
          index + 1,
          `only the checked key "status" may be opted in, found [${names.trim()}]`,
        );
      } else if (!ADMIN_LISTS.some((path) => shown(join(src, path)) === shown(file))) {
        fail(file, index + 1, "only an admin list may opt in to status");
      }
    }
  });
}

if (failures.length) {
  for (const failure of failures) process.stdout.write(`  ${failure}\n`);
  process.exit(1);
}

process.stdout.write(
  "  visibility keys stripped by default, admin lists opt in, base filter folded\n",
);
