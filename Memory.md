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

- Automated tests of any kind. No test runner, no test script, no spec files.
- Email verification gate (intentional, see `PRD.md`).
- Self-serve account deletion (members ask through the contact form).
- Scheduled or resumable-without-a-press newsletter sends (blocked by the plan).

## Open items

Things known to be wrong or unfinished, in the order they matter.

1. **Legal entity placeholders.** `config/legal.ts` ships
   `[YOUR COMPANY NAME]` and `[YOUR REGISTERED ADDRESS]`. AdSense and data
   protection law expect a named entity, so this must be filled before the
   policies are relied on.
2. **`turbo.json` lists dead SMTP/Nodemailer keys** (`SMTP_*`,
   `NODEMAILER_EMAIL_FROM`) from before Resend. Harmless, misleading.
3. **`siteConfig.links` still points at NextUI pages** (github, twitter, docs,
   discord, sponsor). Either point them at real destinations or remove them.
4. **No test suite.** Highest-value first targets: the newsletter batch claim,
   the unsubscribe token, the `auth` middleware, and the allowlisted browser
   proxy.
5. **No web Prettier config.** Only `apps/api` has `.prettierrc.json`, so
   `pnpm format` behaves differently per app.

## Traps and hard-won notes

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
- **`posts` collection, `Post` model name** for what the product calls blogs.
  Keep them when adding indexes.
- **Newsletter issue articles are frozen copies,** and the recipient list is
  frozen at first send. Editing after that is refused on purpose.
- **Blog slugs `new` and `edit` are reserved** (`RESERVED_BLOG_SLUGS`) so an
  article cannot shadow the composer route.
- **`proxy.ts` is a filter, not a gate.** A page or action must re-check the
  session before acting; a proxy check runs on prefetches too.

## Changelog of state

One line per meaningful change in state, with the phase it came from. This is
the only history section here.

- 2026-10-27: PRD, Architecture, Rules, Phases and Memory added; `DESIGN.md`
  already existed and stays the design authority.
- 2026-10 (commit `32a000c`): drafts and admin controls for articles.
- 2026-10 (commit `b23dd58`): cron removed; newsletter sends on press only.
- 2026-10 (commit `97a17a9`): profile became the settings screen; editor moved to
  `/blogs/<slug>/edit`.
