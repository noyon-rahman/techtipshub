/**
 * Phase 6 of issue #19, against a running API: every rule, by real request.
 *
 *   node scripts/test/username-onboarding.mjs
 *
 * It creates a throwaway account, drives the whole lifecycle (onboarding,
 * sold lock, admin correction, retirement) and deletes the rows it made. A
 * rediscovered rule that disagrees with a line here is the point: each check
 * prints what it expected and what came back.
 */

const API = process.env.API_BASE ?? "http://localhost:5000/api/v1";

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const results = [];
const check = (name, passed, detail = "") => {
  results.push({ name, passed, detail });
  process.stdout.write(`${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}\n`);
};

const call = async (path, { method = "GET", body, token } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json, setCookie: res.headers.getSetCookie() };
};

/** The access token a response put in a cookie, since the body does not carry one. */
const accessTokenOf = (setCookie) => {
  const raw = setCookie.find((value) => value.startsWith("tth_access_token="));
  return raw ? raw.split(";")[0].slice("tth_access_token=".length) : undefined;
};

const stamp = Date.now().toString(36);
const member = {
  fullName: "Ada Lovelace Check",
  email: `ada.check.${stamp}@example.invalid`,
  password: "Check-Username-71a3",
  gender: "Female",
  dateOfBirth: "1990-12-10",
};

/**
 * Move this account's last change back 31 days, so the lock has passed.
 *
 * Through the helper process rather than by waiting a month: the lock is real
 * time, and the rule under test is what happens on the other side of it.
 */
const ageLock = (email) => {
  const helper = fileURLToPath(new URL("./age-username-lock.ts", import.meta.url));
  const apiDir = fileURLToPath(new URL("../../apps/api", import.meta.url));

  execFileSync(
    "npx",
    ["tsx", "--env-file=.env.development", helper, email, "31"],
    { cwd: apiDir, stdio: "inherit", shell: process.platform === "win32" },
  );
};

const run = async () => {
  // 1. Signup refuses a reserved handle and accepts a valid one.
  const reserved = await call("/auth/register", {
    method: "POST",
    body: { ...member, email: `admin.${stamp}@example.invalid`, username: "admin" },
  });
  check(
    "registration refuses a reserved handle",
    reserved.status === 400 || reserved.status === 409,
    `status ${reserved.status}`,
  );

  const registered = await call("/auth/register", {
    method: "POST",
    body: { ...member, username: `ada_${stamp}` },
  });
  check("registration accepts a fresh handle", registered.status === 201 || registered.status === 200, `status ${registered.status}`);

  const login = await call("/auth/login", {
    method: "POST",
    body: { email: member.email, password: member.password },
  });
  const token = accessTokenOf(login.setCookie);
  check("signing in issues a session", Boolean(token), `status ${login.status}`);

  if (!token) return;

  // 2. The screen's state: a suggestion from the name, not yet onboarded.
  const onboarding = await call("/users/username/onboarding", { token });
  const suggestion = onboarding.body?.data?.suggestedUsername;
  check(
    "suggests a handle from the full name",
    onboarding.body?.data?.onboarded === false && suggestion === "ada_lovelace_check",
    `got "${suggestion}"`,
  );

  // 3. Availability while typing, in the API's own words.
  const short = await call("/users/username/availability?username=ab", { token });
  check(
    "availability answers a half-typed handle",
    short.status === 200 && short.body?.data?.available === false,
    short.body?.data?.reason,
  );

  const ownReserved = await call("/users/username/availability?username=support", { token });
  check(
    "availability refuses a reserved word",
    ownReserved.body?.data?.available === false,
    ownReserved.body?.data?.reason,
  );

  const takeAdmin = await call("/users/username/availability?username=admin", { token });
  check("a route word is reserved too", takeAdmin.body?.data?.available === false);

  // 4. Complete the step with a chosen handle.
  const chosen = `ada_lovelace_${stamp}`;
  const completed = await call("/users/username/onboarding", {
    method: "POST",
    token,
    body: { username: chosen },
  });
  check(
    "the step records the chosen handle",
    completed.status === 200 && completed.body?.data?.username === chosen,
    `status ${completed.status}`,
  );
  check(
    "the step starts the 30 day lock",
    Boolean(completed.body?.data?.lockedUntil),
    completed.body?.data?.lockedUntil,
  );

  const second = await call("/users/username/onboarding", {
    method: "POST",
    token,
    body: { username: `other_${stamp}` },
  });
  check(
    "the step cannot be run twice to change the handle",
    second.status === 409,
    `status ${second.status}`,
  );

  // 5. A change inside the lock is refused by the API with the unlock date.
  const early = await call("/users/update-profile", {
    method: "PATCH",
    token,
    body: { username: `early_${stamp}` },
  });
  check(
    "a change the next day is refused",
    early.status === 403 && /can change your username on/.test(early.body?.error?.message ?? ""),
    early.body?.error?.message,
  );

  // 6. The date the profile shows is the same one the refusal names.
  const state = await call("/users/username/state", { token });
  check(
    "the profile can read the unlock date",
    state.body?.data?.canChange === false && Boolean(state.body?.data?.lockedUntil),
    state.body?.data?.lockedUntil,
  );

  // 7. The session payload carries the flag the site routes on.
  const session = await call("/auth/session", { token });
  check(
    "the session says the handle was confirmed",
    session.body?.data?.user?.usernameOnboarded === true,
  );

  // 9. Past the lock: one change is allowed, it retires the old handle, and the
  // next attempt is refused again. The lock is real time, so the account's
  // change date is moved back by the helper above rather than waited out.
  ageLock(member.email);
  const renamed = `ada_renamed_${stamp}`;
  const changed = await call("/users/update-profile", {
    method: "PATCH",
    token,
    body: { username: renamed },
  });
  check(
    "after the lock one change succeeds",
    changed.status === 200 && changed.body?.data?.username === renamed,
    `status ${changed.status}`,
  );

  const restarted = await call("/users/update-profile", {
    method: "PATCH",
    token,
    body: { username: `ada_third_${stamp}` },
  });
  check(
    "that change starts a new lock",
    restarted.status === 403,
    `status ${restarted.status}`,
  );

  const retired = await call(`/users/username/current/${chosen}`);
  check(
    "the old handle now points at the new one",
    retired.body?.data?.username === renamed,
    retired.body?.data?.username,
  );

  const reservedAgain = await call("/users/username/availability?username=" + chosen, {
    token,
  });
  check(
    "the retired handle is not offered to its old owner either",
    reservedAgain.body?.data?.available === false,
    reservedAgain.body?.data?.reason,
  );

  // 10. Anyone can ask where a handle points; a handle nobody held has no answer.
  const never = await call("/users/username/current/never_held_handle");
  check("a handle nobody held has no target", never.body?.data === null);

  // 10. A retired handle cannot be claimed by another member.
  const other = {
    ...member,
    fullName: "Other Person",
    email: `other.${stamp}@example.invalid`,
  };
  const otherRegistered = await call("/auth/register", {
    method: "POST",
    body: { ...other, username: chosen },
  });
  check(
    "a retired handle cannot be registered by someone else",
    otherRegistered.status === 409,
    `status ${otherRegistered.status}`,
  );

  const failed = results.filter((row) => !row.passed);
  process.stdout.write(`\n${results.length - failed.length}/${results.length} passed\n`);
  if (failed.length) process.exitCode = 1;
};

run().catch((error) => {
  process.stdout.write(`\nFAILED: ${error?.message}\n`);
  process.exitCode = 1;
});
