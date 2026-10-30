# Memory

The agent's notebook for this project. Live state, not history: what is true
now, what is open, what bit us last time. Newest at the top of each section. If
a line here stops being true, delete it; do not append a correction under it.

Product scope: [`PRD.md`](./PRD.md). Work queue: [`Phases.md`](./Phases.md).
Conventions: [`Rules.md`](./Rules.md).

## Standing facts

- Two apps, two deployments: `apps/web` (Next 16, App Router) and `apps/api`
  (Hono on Node). Shared types and enums in `packages/shared`. Turbo drives both.
- Hosted on Vercel. **The plan is Hobby, so cron jobs run daily at most.** That
  is why the newsletter sends in batches on an admin press, not on a timer
  (commit `b23dd58` removed the cron path). Do not reintroduce a short cron.
- Auth is JWT in two httpOnly cookies set by the API (`tth_access_token`,
  `tth_refresh_token`). The web app never decodes a token; it asks
  `GET /auth/session`. `tokenVersion` on the user row is what revokes a session.
- An article body is only revealed to a browser that holds a session. Crawlers
  get the `?view=preview` variant via `proxy.ts`.
- The Next.js in `apps/web` is newer than most training data. `next dev` writes
  `apps/web/AGENTS.md` and points at `apps/web/node_modules/next/dist/docs/`.
  Read the guide there before using a Next API.
- HeroUI v2, Tailwind v4, Tiptap 3, TanStack Query v5, react-hook-form + zod.
- Theme default is **dark**, with a working light mode. Theme colours and fonts
  are in `apps/web/tailwind.config.js`, not in `globals.css`.
- The shipped logo and brand files are in `apps/web/public/brand/`. Read its
  `README.md` before touching them.

## Current state

### Working, end to end

- Accounts: register, log in, Google sign-in, forget and reset password, sign
  out. Blocked and deleted accounts refused everywhere.
- Articles: composer and editor with drafts, publish, cover image, category,
  tags, code blocks. Member list at `/profile/blogs`, admin list, admin composer
  writing on a member's behalf, permanent delete and restore.
- Reading: feed, following feed, search, category pages, article page with
  gated body, votes, comments, follow, view counting, related reading.
- Profile: public view and edit in one page at `/profile/@<handle>`, social
  links, photo, followers and following lists.
- Admin: all thirteen screens in `docs/admin-panel.md`, shared kit, activity log.
- Newsletter: signup blocks, profile switch, issue builder, preview, test send,
  batched sending with per-recipient claims, unsubscribe links, Resend webhook
  suppression, subscriber list, CSV export.
- Site: legal pages (six), about, features, contact form, SEO metadata, sitemap,
  robots, AdSense slots, GTM/GA.

### Not built

- Unit and browser tests. `pnpm test` is a repository gate (typecheck, format,
  invariants, the list filter check, lint, build), not a spec suite.
- Email verification gate (intentional, see `PRD.md`).
- Self-serve account deletion (members ask through the contact form).
- Scheduled or resumable-without-a-press newsletter sends (blocked by the plan).

## Open items

Things known to be wrong or unfinished, in the order they matter.

1. **CI does not run `pnpm test`.** The gate exists and passes locally; the
   host still builds without it. Wiring it into the deploy pipeline is the next
   step that makes it worth having.
2. **The newsletter claim and lease have no unit test.** The invariants cover
   the shapes around it, but a concurrent-send test needs a database.
3. **`apps/web` lint carries about 33 warnings**, mostly unused imports. They
   do not fail the gate.

## Traps and hard-won notes

- **The admin footer sits on the fold of a short page.** The admin column in
  `(adminLayout)/layout.tsx` is `min-h-dvh` with a `flex-col` `main` that
  grows, so the sign-off rule lands at the same height on every screen. Do not
  wrap the admin pages in a full-height `div` or a second scroll container:
  either one breaks the fill and the footer floats up again.
- **Admin row menus portal to the body.** `ListFrame` clips its corners, so
  anything absolutely positioned inside a table row is cut off at the frame's
  edge. `users-table/row-menu.tsx` places its panel with fixed coordinates and
  flips up when the row is near the viewport bottom. Any new in-row popover in
  an admin list needs the same treatment.
- **`pnpm test` is the gate.** It runs typecheck, the format and invariant
  checks, the list filter check, lint and both builds, and stops at the first
  failure. `pnpm test lint` runs one step. The invariants live in
  `scripts/test/checks/` and read the tree, so they catch a placeholder or an
  unlisted env key that types cannot. `query-filter.mjs` runs the real
  `QueryBuilder` through the app's own tsx and needs no database: `.find()`
  builds a query and `getFilter()` reads it back without connecting.
- **The legal pages name a person, not a company.** `config/legal.ts` says
  `Novon Rahman, publishing as TechTipsHub` and gives the contact address as the
  address of record. Do not add a registered company or a street address that
  does not exist.
- **One Prettier config, at the root.** `prettier.config.mjs` governs both apps.
  An app-level config is a second opinion, and the format check fails on one.
- **Changing the JWT secrets, or `NEWSLETTER_UNSUBSCRIBE_SECRET` when it is
  unset (the key derives from the JWT secrets), invalidates every unsubscribe
  link already in a mailbox.** Set the dedicated secret before the first real
  send.
- **`QueryBuilder` drops `status` and `isDeleted` unless a list opts in.** The
  default is deny because most callers hand over the raw request query; only a
  list that has already whitelisted the value passes
  `{ allowVisibilityFilters: ["status"] }` (subscribers, inbox, members). A new
  admin list with a status tab needs that option, or the tab highlights and the
  rows never change.
- **Admin list filters live in the URL.** Every admin list reads and writes its
  tab, page, page size and search through `useAdminListParams`
  (`hooks/use-admin-list-params.ts`, pure half in `lib/admin-list-params.ts`),
  so a reload, a bookmark or a shared link returns the same view. Setters use
  `router.replace`, not `push`. Params the schema does not declare (a
  `?message=` deep link) are preserved. A screen using it must sit under a
  `<Suspense>` boundary or the production build fails.
- **Mongo filters live in model middleware.** `find`/`findOne` hide trashed rows
  and drafts unless the call passes `bypassMiddleware` / `includeDrafts`. A
  query that returns "nothing" is usually a missing option, not a missing row.
- **The browser API proxy is an allowlist.** A route that works from the server
  component fails from the browser until it is added to
  `app/api/v1/[...path]/route.ts`. That is on purpose.
- **Hono adds no `sameSite` default.** The session cookies set it explicitly in
  `session-cookies.ts`.
- **The API validates env on import.** On Vercel a bad value throws inside the
  function instead of exiting at boot, on purpose, so the reason reaches the log.
- **CORS on the API is a fixed list in `app/app.ts`.** A new origin needs a code
  change, not a dashboard setting.
- **`totalPosts` is stored, `totalBlogs` is exposed.** The model has a virtual
  for the second name; do not rename the stored field.
- **Collection names are pinned, not derived.** Every model passes its stored
  name as the third argument of `model()` (`blog.model.ts` keeps `posts` for
  `Post`). Renaming a model therefore leaves the data where it is; changing a
  collection's name is a migration, through `pnpm migrate:collections`.
- **`pnpm migrate:collections` is run by hand, against production, before the
  deploy that renames a collection.** Vercel's build only typechecks, so nothing
  runs it for you. It moves rows into the pinned collection, keeps the old rows
  as `<name>_migrated`, and prints them so the copies can be dropped once
  checked.
- **Newsletter issue articles are frozen copies,** and the recipient list is
  frozen at first send. Editing after that is refused on purpose.
- **Blog slugs `new` and `edit` are reserved** (`RESERVED_BLOG_SLUGS`) so an
  article cannot shadow the composer route.
- **`proxy.ts` is a filter, not a gate.** A page or action must re-check the
  session before acting; a proxy check runs on prefetches too.

## Changelog of state

One line per meaningful change in state, with the phase it came from. This is
the only history section here.

- 2026-10-30: #11 fixed. `QueryBuilder` keeps a validated `status` for the three
  admin lists that opt in (newsletter subscribers, contact inbox, members);
  draft and deleted rows still cannot be asked for on a public list. Every
  admin list keeps its filters in the URL (`useAdminListParams`). The gate
  gained `query-filter`, a database-free check on the builder's visibility
  guard.
- 2026-10-28: Collections renamed to snake_case and pinned in every model
  (`admin_logs`, `newsletter_subscribers`, `newsletter_campaigns`); the
  `authhandoffs` collection is gone, the Google handoff is a signed JWT;
  `payments` and `subscriptions` given models (`modules/billing/`); migration
  script `pnpm migrate:collections` added.
- 2026-10-27: Phase 7 (hardening) done. Legal pages name the operator;
  `siteConfig.links` and the dead SMTP keys removed; `pnpm test` added as the
  typecheck/format/invariants/lint/build gate; one root Prettier config, applied
  across the repo.
- 2026-10-27: PRD, Architecture, Rules, Phases and Memory added; `DESIGN.md`
  already existed and stays the design authority.
- 2026-10 (commit `32a000c`): drafts and admin controls for articles.
- 2026-10 (commit `b23dd58`): cron removed; newsletter sends on press only.
- 2026-10 (commit `97a17a9`): profile became the settings screen; editor moved to
  `/blogs/<slug>/edit`.
