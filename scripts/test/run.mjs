import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

/**
 * The root `pnpm test` entry point.
 *
 * There is no browser test suite, and a unit runner that only covered pure
 * helpers would give a green light that meant nothing. So the gate is the set
 * of checks that catch real breakage: typecheck, the formatting and repository
 * invariants, lint, and a production build of both apps.
 *
 * A step passes only when it exits 0. The first step to fail stops the run,
 * because lint output after a failed typecheck is noise; the exit code is 1.
 *
 *   node scripts/test/run.mjs               the whole gate
 *   node scripts/test/run.mjs lint build    only the named steps
 */

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

// `pnpm` is a .cmd shim on Windows and cannot be spawned without a shell, so the
// scripts run through cmd.exe there. Passing them as separate arguments, not as
// one concatenated string, is what keeps the quoting intact.
const run = (argv) =>
  new Promise((resolveExit) => {
    const child =
      process.platform === "win32"
        ? spawn("cmd.exe", ["/d", "/s", "/c", ...argv], {
            cwd: root,
            stdio: "inherit",
          })
        : spawn(argv[0], argv.slice(1), { cwd: root, stdio: "inherit" });

    child.on("error", (error) => {
      process.stdout.write(`  could not start: ${error.message}\n`);
      resolveExit(1);
    });
    child.on("exit", (code) => resolveExit(code ?? 1));
  });

const steps = [
  {
    name: "typecheck",
    argv: ["pnpm", "run", "-r", "--if-present", "typecheck"],
  },
  { name: "format", argv: ["node", "scripts/test/checks/format.mjs"] },
  { name: "invariants", argv: ["node", "scripts/test/checks/invariants.mjs"] },
  { name: "lint", argv: ["pnpm", "run", "-r", "--if-present", "lint"] },
  { name: "build", argv: ["pnpm", "run", "-r", "--if-present", "build"] },
];

const requested = process.argv.slice(2);
const unknown = requested.filter(
  (name) => !steps.some((step) => step.name === name),
);

if (unknown.length) {
  process.stdout.write(`Unknown step(s): ${unknown.join(", ")}\n`);
  process.stdout.write(
    `Known steps: ${steps.map((step) => step.name).join(", ")}\n`,
  );
  process.exit(2);
}

const selected = requested.length
  ? steps.filter((step) => requested.includes(step.name))
  : steps;

/**
 * The API validates its environment on import, so a build on a machine whose
 * variables live only in the app's own file fails on a missing variable rather
 * than on a missing feature. Vercel injects the real values and has no file.
 */
const envFile = [".env.production", ".env.development", ".env"]
  .map((name) => join(root, "apps/api", name))
  .find((file) => existsSync(file));

for (const step of selected) {
  process.stdout.write(`\n> ${step.name}: ${step.argv.join(" ")}\n`);

  const code = await run(step.argv);

  if (code !== 0) {
    process.stdout.write(`\nFAIL: ${step.name} exited with ${code}\n`);
    process.exit(1);
  }
}

if (selected.some((step) => step.name === "build") && envFile) {
  process.stdout.write(
    `  note: the API build reads its env at run time from apps/api/${envFile.split(/[\\/]/).pop()}\n`,
  );
}

process.stdout.write(
  `\nPASS: ${selected.map((step) => step.name).join(", ")}\n`,
);
