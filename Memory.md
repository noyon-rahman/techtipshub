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
- Categories: searchable picker in every composer, showing each category with
  its published article count. A signed-in member who needs one the list does
  not have types the name and picks the `Create <name>` row, which posts
  `POST /categories` and selects the new category in place. Guests write drafts
  only and get no create row. Admins manage categories on their own screen.
- Reading: feed, following feed, search, category pages, article page with
  gated body, votes, comments, follow, view counting, related reading. The feed
  card shows the top eight by blog count and links to `/categories`, which is
  the mobile entry point for the whole list.
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
  invariants, lint, build), not a spec suite.
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
4. **The admin account's password is the throwaway `Check-Admin-71a3`, and
   `tokenVersion` is 2.** The hash was swapped during the category checks and
   the saved original was lost with the scratch folder. It is the only Admin, so
   the product cannot reset it: the owner has to run forget-password on
   `admin.techtipshub@noyonrahman.com`, or the hash is set by hand. Until then
   the admin categories screen has not been opened by eye since the request tab
   came out.

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
  checks, lint and both builds, and stops at the first failure. `pnpm test lint`
  runs one step. The invariants live in `scripts/test/checks/` and read the tree,
  so they catch a placeholder or an unlisted env key that types cannot.
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
- **A draft's category name is kept beside its id.** The composer stores the
  name in the draft (`categoryName`), because the list a restored draft would
  look the id up in may have been refetched without it, and a category can be
  renamed or removed. Anything that resolves a category for display has to fall
  back to the stored name (`categoryName` in `editor-shell.tsx`), or the draft
  reads back blank.
- **A category made from the composer is a live category.** `POST /categories`
  runs the same service as the admin create, so there is one duplicate check and
  one 409. It writes no activity-log row: `adminLogService.record` only files
  rows for an admin's email, and the log is the admins' own record.
- **A category's `blogCount` is counted from the articles, not from the stored
  `postCount`.** The stored number only moves when an article is created,
  published, deleted or moved, so it drifts, and a reader sent to a category
  page would see a different total. `category.service.ts` counts both lists from
  one aggregate; do not read the model field for a number a reader sees. The
  model also needs `toJSON: { virtuals: true }` for `blogCount` to exist at all.
- **The category list is cached for an hour and tagged `categories`.** The
  browser reads it through one TanStack entry (`useCategoryList`), shared by the
  picker's retry, the composer and the edit screen; a category made from the
  composer is written into that entry by the mutation (`setQueryData`), so the
  picker shows it before the next refetch. The server list (`siteCategories`)
  is the same data under the same tag, so an admin category edit invalidates both.
- **`proxy.ts` is a filter, not a gate.** A page or action must re-check the
  session before acting; a proxy check runs on prefetches too.
- **The interceptor attaches the session only.** `lib/AxiosInstance` returns the
  request untouched when the caller already set `Authorization`, and the reset
  call never goes through `/api/v1` (that proxy refuses a request with no
  session, and a signed-out reset has none). A reset token rides in
  `X-Reset-Token` when the browser holds a session, so a session token can never
  take its place. Any new call carrying its own credential needs the same two
  things.
- **A reset link works once.** The API compares the JWT's `iat` with the user's
  `passwordChangeAt` and answers "already been used" when the password changed
  after the token was minted. The screen shows the API's own sentence for every
  refusal: a spent or expired link gets "Request a new link", anything else
  (blocked account, no answer, too many tries) gets "Back to sign in". Only a
  password the rule rejects keeps the form, with the API's field message shown.
- **A password is 8 characters, in the form and in the API.** `password()` in
  `auth.validation.ts` and `newPasswordValidationSchema` must agree; the form's
  bound was 6 for a while, so a six-character password passed the form and then
  failed at the API with "did not pass validation".

## Changelog of state

One line per meaningful change in state, with the phase it came from. This is
the only history section here.

- 2026-10-30: Password reset fixed (#15). The reset call no longer picks up the
  session's `Authorization` (or loses its own token in the browser), so links
  stop reporting "not valid"; a failed reset that is not about the link says so
  instead of blaming it; links are one-time. One shared `PasswordInput` (44px
  show/hide button inside the field, amber focus ring in both themes) now serves
  login, signup and reset.
- 2026-10-30: Category handling fixed (#5). Searchable picker in both composers
  and the admin one, each category listed with its published count; the feed
  card shows the top eight and `/categories` is a directory of every category.
  Members create a category from the composer the moment they name it
  (`POST /categories`, no admin step); the `category_requests` collection, its
  routes, the admin `Requested` tab and the request dialog are removed, leaving
  `category_requests` data in the database unread.
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
