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
- An article body is revealed to a browser without a session only when the
  author chose "Everyone"; the default and every older row is "Members only",
  where the body waits on the session and crawlers get the `?view=preview`
  variant via `proxy.ts`. A public article is plain, indexable, and its preview
  variant redirects to it.
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
  tags, code blocks, and a per-article access setting ("Everyone" or "Members
  only") shown in both composer rails, both editors, the member article list,
  the admin table and the moderation queue. Member list at `/profile/blogs`,
  admin list, admin composer writing on a member's behalf, permanent delete and
  restore.
- Categories: searchable picker in every composer, showing each category with
  its published article count. A signed-in member who needs one the list does
  not have types the name and picks the `Create <name>` row, which posts
  `POST /categories` and selects the new category in place. Guests write drafts
  only and get no create row. Admins manage categories on their own screen.
- Reading: feed, following feed, search, category pages, article page with
  gated body, votes, comments, follow, view counting, related reading. The feed
  card shows the top eight by blog count and links to `/categories`, which is
  the mobile entry point for the whole list.
- Feed tabs: one list in `components/modules/feed/feed-tabs.ts`, read by the
  left rail and the phone row. `All` is `/` (everything published, in the site's
  order, the one tab a signed-out visitor gets), `Personalized` is `/personalized`
  (topics first), `Following` is `/following` (newest first, from the writers
  followed).
  The two personal tabs need a session, so they are not drawn without one.
- Following: paged by the API from `readFollowingPage` in `blog.ranking.ts`, not
  from `GET /blogs/feed` (that one leaves out the reader's own articles).
  Following nobody is an empty page with authors to follow, never a 404; the
  page tells the two empty states apart by `meta.following`.
- Feed order: one engagement ranking for everyone (`blog.ranking.ts`), your
  topics first for a signed-in reader who picked some, and a reason line that
  says which one you are looking at. `/search` and `/categories/<name>` stay
  newest first.
- Interests: a one-time step at `/welcome` after a first password or Google
  sign-in, skippable, changeable from the profile. The profile shows the picked
  topics as a band under "Edit profile" (outside the editor), and both "Change
  topics" and a `#topics` link from the feed's reason line open the editor on
  the picker. The answer lives on the account as `interests[]` plus
  `interestsAnsweredAt`.
  The step keeps the site's own header and footer: it has to read as part of
  TechTips Hub, not as a separate product. The topic Picker is quiet ink with an
  amber tick, and the one amber fill on the screen is "Save and continue".
- Usernames: the handle step sits at `/welcome/username`, before the topics step,
  so the two prompts never stack. The API suggests a free handle from the full
  name, the member confirms or replaces it, and that records
  `usernameOnboardedAt` and starts the 30 day lock. A change from the profile
  then waits `usernameChangedAt + 30 days`; the lock is computed, never stored.
  Every retired handle stays in `username_history` for a year, refused to
  everyone, and `/users/<old>` answers a permanent redirect to the current one
  (`/followers`, `/following` included). Existing members were marked onboarded
  by `pnpm migrate:username-onboarding`.
- Profile: public view and edit in one page at `/profile`, social
  links, photo, followers and following lists.
- Admin: all thirteen screens in `docs/admin-panel.md`, shared kit, activity log.
- Newsletter: signup blocks, the on/off switch on the profile page itself (no
  editor needed), issue builder, preview, test send,
  batched sending with per-recipient claims, unsubscribe links, Resend webhook
  suppression, subscriber list, CSV export.
- Site: legal pages (six), about, features, contact form, SEO metadata, sitemap,
  robots, AdSense slots, GTM/GA.

### Not built

- Unit and browser tests. `pnpm test` is a repository gate (typecheck, format,
  invariants, the list filter check, lint, build), not a spec suite. The username
  rules do have a live run: `node scripts/test/username-onboarding.mjs` (with
  `age-username-lock.ts` beside it) drives the real API through 19 checks,
  including a lock aged in the database. It is not wired into the gate because it
  needs a running API and writes throwaway `@example.invalid` accounts.
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
4. **The admin account's password is unknown, and the entry below describing it
   was wrong.** A login with `Check-Admin-71a3` now answers "Incorrect
   credentials", so that note was stale or the hash moved again. It is the only
   Admin, so the product cannot reset it: the owner has to run forget-password on
   `admin.techtipshub@noyonrahman.com`, or the hash is set by hand. Until then
   any admin-only path is covered only by typecheck and the live script's
   non-admin stages.
5. **Username verification leaves rows behind.** Each run of
   `scripts/test/username-onboarding.mjs` adds a few `@example.invalid` accounts
   and `username_history` entries in the dev database. They are harmless (the
   addresses cannot receive mail) but they do hold their handles, so a reused
   literal handle would fail on a second run; the script suffixes every run.
6. **A real 301 has not been seen in a browser.** The redirect logic is covered
   by the API stage (old handle points at the new one) and by the build, but
   `permanentRedirect` was never observed over a network response, which needs
   `next start` rather than `next dev`.

## Traps and hard-won notes

- **HeroUI's `Modal` is dismissable unless told otherwise.** `isDismissable`
  defaults to `true`, so a press anywhere outside the panel closes it. For a
  confirm or a dialog with typed input that reads as the dialog "auto-closing"
  on a stray click; pass `isDismissable={false}` and leave Escape and Cancel as
  the close paths.
- **A React portal does not move a click out of the React tree.** HeroUI's
  `Modal` renders through `createPortal` to `document.body`, but the portalled
  content still bubbles to its React-tree ancestors. So a menu panel whose
  `onClick` closes itself will unmount any dialog rendered inside it. Close on
  the menu item, not on the panel.
- **A menu must not close while a dialog opened from its items is open.** That
  was the remaining half of the row-menu bug. `RowMenu` also closes on a
  document `pointerdown` outside the panel, and the press on a dialog's own
  button is outside it: the panel unmounted between `pointerdown` and `click`,
  so the click never landed and Confirm did nothing. `ConfirmDialog` reports
  its open state through `menu-dialog-open.tsx` (`useReportMenuDialog`, from
  the provider each `RowMenu` mounts), and the panel's `pointerdown`, Escape,
  `scroll` and `resize` closers stand down while it is set. Any new dialog
  opened from a row-menu item should render a `ConfirmDialog` so it is covered,
  or report through the same context.
- **`useDisclosure().onOpenChange` takes no argument and toggles.**
  `@heroui/use-disclosure` picks open or close from the `isOpen` it captured at
  its last render, so it cannot carry a target state. Use `onOpen`/`onClose`
  when a caller passes one.
- **HeroUI's `Textarea` ignores an `onChange` prop.** React Aria's
  `useTextField` owns the value, and `getInputProps` spreads the caller's props
  through `filterDOMProps` with `omitEventNames` set to the Aria handlers, so a
  raw `onChange` is dropped rather than chained. Write through `onValueChange`
  and read through `value`; do not hand a `<textarea>` registration to it.
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
- **ESLint can abort on Windows with exit `3221226505` (`0xC0000409`) or
  `Cannot find module './esnext.array'`.** Both come from the process, not the
  code: nothing is reported and the same tree passes on the next run. Re-run
  `pnpm install --frozen-lockfile`, then lint that package again before you
  believe a lint failure.
- **The article gate is per-article, and the API answers with `access`.** Three
  rules keep it in step. A missing `access` means members only, read in one
  place (`articleAccessOf` in the API's blog constants and in
  `lib/article-access.ts`), so older rows need no migration and must not be
  written as `public`. The page decides the body from that value: public
  renders one column and mounts no check, members-only renders both and waits
  on `ArticleAccess`. Canonical, JSON-LD `mainEntityOfPage` and the sitemap all
  use `articleIndexablePath`, so a public article is indexed at
  `/blogs/<slug>` and a members-only one at `?view=preview`; the preview
  variant of a public article redirects to the plain address.
- **The feed's order is decided in one file and nowhere else.**
  `blog.ranking.ts` owns the score, the personalized lead, and the `sort`
  vocabulary (`ranking` or `newest`, anything else is a 400). Three things about
  it are easy to get wrong. An aggregation never runs the model's `pre("find")`
  hook, so `LIVE_ARTICLE` is written into the match by hand. Inside an
  aggregation `$in` does not compare a string id to an `ObjectId` field, so
  interest ids are cast on the way in and the matched category ids come out as
  ObjectIds from a `$group`, not as the strings `distinct` returns. And the lead
  flag is sorted descending, so a topic article gets `1` and is named
  `interestLead`: a flag with the sort the other way round silently puts the
  reader's own topics last, which still looks like a plausible feed.
- **`reason` is a sibling of `meta` in the ranking, and `meta` is what is sent.**
  `readFeedPage` returns `{ result, meta, reason }`; the blog controller puts
  `reason` into `meta` for the response (`TPaginationMeta` has the field). A
  destructure of only `{ meta, result }` typechecks and quietly drops it, which
  shows up as a feed that is correctly ordered but says nothing about why.
- **A page must not call `getSession`.** `getSession` renews the session and
  writes the cookies back, which only a proxy or a route handler may do. Calling
  it from a prerendered page throws "Cookies can only be modified in a Server
  Action or Route Handler" and drops the page to client rendering. `/welcome`
  reads `readReaderSession` (cookie in, no write) and leaves the account's
  answer to a server action.
- **The homepage must stay prerendered.** `/` renders the order every reader
  gets and `FeedBlogs` asks a server action for the reader's own page after
  load. Reading the session, the interests or `searchParams` in the page would
  turn it into a per-request render. Filtered views live at `/search` and
  `/categories/<name>` for the same reason.
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
  `app/api/v1/[...path]/route.ts`. That is on purpose. `POST /uploads/cover` and
  `DELETE /uploads/asset` are on it so the browser can upload and delete a cover.
- **A cover is an asset from the moment it is picked.** The picker uploads it
  through `POST /uploads/cover` (downscaled to 1600 px first) and the composer
  holds its `{ url, publicId }`; publish and edit send only the URL as JSON. A
  replacement, a removal, a discarded draft and leaving the composer delete an
  asset with `DELETE /uploads/asset`, best effort. Only assets this screen
  uploaded are ever deleted: a saved cover on the edit screen is the article's
  and survives a new pick until the update is accepted. `use-cover-asset.ts`
  owns that rule. Draft storage keeps the `File` only, never a URL, because a
  reloaded asset was deleted when the last visit ended; a restored file uploads
  again. The admin composer still sends multipart through `/admin/blogs`. A
  closed tab can leave one orphaned asset; do not add a cron for it.
  `POST /uploads/signature` still exists in the API but nothing in the web app
  calls it, so it is off the proxy allow list.
- **A delete is authorised by folder, not by owner.** `DELETE /uploads/asset`
  trusts a `publicId` from the browser, so it refuses anything outside
  `techtipshub/{covers,avatars,images}/`. Without that check any signed-in member
  could delete any asset on the Cloudinary account, the logo included. Note it
  does not check *whose* asset it is; a member can delete another member's cover
  if they learn its id. Ids are random hex, so it is not guessable, but an
  owner column would be the next step if that matters.
- **One upload limit, `apps/web/src/lib/upload-limits.ts`.** 4 MB for covers,
  for profile photos and for avatars. `next.config.js` reads the same number for
  `experimental.serverActions.bodySizeLimit`, and the API refuses the same 4 MB
  in `withUploads`. Article JSON is checked separately by `validateUploadSize`.
- **A JSON route must not also run `withUploads`.** `POST /blogs` and
  `PUT /blogs/:id` take JSON now; `withUploads` reads a JSON body as "no form"
  and stores `{}` as `uploadedBody`, which silently satisfied the schema with
  nothing and produced "Title must be a string" on every publish. `readBody`
  also ignores an empty `uploadedBody` for the same reason. Only the admin
  routes still upload a file.
- **A `THInput` registers last, on purpose.** `register(name)` carries the ref
  react-hook-form reads a value through; spreading it first let a caller's
  `placeholder` replace it, and the field's value then never reached the form.
  It typechecks, validates and saves, so the only symptom is a field that
  silently is not sent. Pass `name` as that prop, never as a second spread.
- **The handle is saved on its own, not with the profile.** `UsernameField`
  calls the API through `changeUsernameAction`; the profile form deletes any
  `username` from its payload. One save must not be able to change an address
  and a name together, and a refused handle must not take a photo down with it.
- **A handle is claimed through one rule, and the lock is never stored.**
  `normaliseUsername`, `usernameProblem` and the reserved words live once in
  `packages/shared/src/username.ts`, and validation, availability, the suggestion,
  registration and Google signup all call them, so the same handle cannot be
  described two ways. The 30 day wait is derived from `usernameChangedAt` in
  `username.rules.ts` (`usernameLockEndsAt`); do not add a stored expiry, it will
  drift. Two writes are deliberate: the onboarding step is exempt from the lock
  but stamps `usernameChangedAt`, so a new member cannot rename immediately
  after choosing, and a rename writes a `username_history` row before it moves,
  which is what makes the old address redirect. That collection is separate from
  the user on purpose: another member, and a deleted account, must be able to
  block a claim.
- **A `"use server"` module may export only async functions.** `typecheck` and
  lint both pass on an arrow that returns a promise without `async`; only
  `next build` refuses ("Server Actions must be async functions"). `services/
  reader/username.ts` is an action module, so the public handle lookup lives
  beside it in `services/reader/current-handle.ts`. A server component must
  never import an action module for a read.
- **The handle step is `/welcome/username`, not `/welcome`.** `afterSignInPath`
  routes handle, then topics, then the destination, so the two one-time prompts
  never stack; `afterUsernamePath` always continues to `/welcome`. `/welcome` is
  in `PROTECTED_AREAS`, which is why both pages can stay prerendered and let the
  proxy send a signed-out visitor to `/login`.
- **The public profile address is `/users/<handle>`.** The issue that asked for
  this work wrote `/profile/<handle>`, but that route is behind a session; the
  handle step shows and links the real public one, so "your profile is
  public at ..." is true.
- **Every `DropdownItem`/`SelectItem`/`AutocompleteItem` whose label is not one
  plain string needs `textValue`.** `react-stately` warns once per item at mount
  ("`<Item>` with non-plain text contents…"), so a composer-only check misses it:
  the account menu in the navbar renders on every page, signed in. Element
  children, a ternary on `isCopied`, or an icon plus text all count as
  non-plain.
- **`next dev` allows one server per app directory.** A second one on another
  port refuses to start, and the first keeps serving the code it compiled. If a
  source change does not show up in the browser, the server is stale: restart
  it (`taskkill /PID <pid> /F`) instead of testing against a second port.
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
- **A published article's page is two callers of one reader.** `generateMetadata`
  and the body of `/blogs/[slug]` both go through `getArticlePage`; metadata used
  to read only the build index, so a slug published after the last build got the
  "Article not found" head over a body that rendered. Any new renderer of the
  page reads it the same way. `updateTag` only works in a Server Action, so the
  publish is one; `revalidateTag(tag, { expire: 0 })` is the copy that works in a
  route handler.

- **A password is 8 characters, in the form and in the API.** `password()` in
  `auth.validation.ts` and `newPasswordValidationSchema` must agree; the form's
  bound was 6 for a while, so a six-character password passed the form and then
  failed at the API with "did not pass validation".

## Changelog of state

One line per meaningful change in state, with the phase it came from. This is
the only history section here.

- 2026-11-12: Row-menu confirm dialogs actually run their action now. The panel
  was still closing on the document `pointerdown` that starts a press on the
  dialog's own button, so the dialog unmounted before the `click` fired: the
  button looked inert. `RowMenu` mounts a `MenuDialogOpenProvider`, the shared
  `ConfirmDialog` reports its open state, and the panel leaves Escape, presses,
  scrolls and resizes to the dialog while one is open. Verified on
  `/admin/manage-users` (block, unblock, make admin, delete) and
  `/admin/manage-blogs` (publish, trash): the action lands, the row and the
  counters follow.
- 2026-11-11: Admin delete dialogs closed on a press outside the panel. HeroUI's
  `Modal` defaults `isDismissable` to `true`, so clicking the page behind the
  dialog, which the user was aiming at, discarded the question and the typed
  reason. `ConfirmDialog` and the article delete dialog now set
  `isDismissable={false}`: the answer comes from the dialog, and Escape or
  Cancel is the way out that does not answer.
- 2026-11-11: Admin row-menu confirm dialogs were inert (#21's sibling). `RowMenu`
  had `onClick={() => setOpen(false)}` on its portalled panel. HeroUI portals a
  modal to `document.body`, but a React portal keeps the React-tree parent, so a
  click on the dialog's confirm button still bubbled through that panel and
  unmounted the `ConfirmDialog` and its pending mutation. That hit every confirm
  action on `/admin/manage-users` (block, unblock, make admin, delete) and
  `/admin/manage-blogs` (publish, trash), and only those two, since they are the
  only screens whose confirm dialog lives inside a `RowMenu`. The panel now
  closes only when the click lands on a `[role="menuitem"]`.
- 2026-11-11: #21 fixed. The admin delete-article dialog's Confirm did nothing:
  `THTextarea` spread `{...props}` over `{...register(name)}`, and HeroUI's
  `Textarea` drops an `onChange` prop entirely (it chains only React Aria's), so
  react-hook-form never saw a keystroke and `handleSubmit` failed silently. The
  registration now goes last, as in `THInput`, which also repairs the contact
  form, the comment forms and the profile bio. The dialog itself is now
  controlled with no `THForm` (it mounted its own `useForm`, so its submit never
  received the value anyway), requires a trimmed reason, stays open on
  `success: false`, and names the article it deletes.
- 2026-11-02: Every feed request is one page of 10, throughout. The landing
  page and `/personalized` used to render 5 and the list then asked for 5 again
  on its first action; a full page is now the signal that another page exists,
  so a 5-card first render would have ended the list after ten. All five screens
  that share the list (`/`, `/personalized`, `/following`, `/search`,
  `/categories/<slug>`) ask for 10 per call.
- 2026-11-02: `POST /views/<slug>` read `validatedBody`, which nothing sets on
  that route (it declares no validator), so `visitorId` was always undefined and
  every guest view was a silent no-op: the count never moved. The controller now
  reads its own JSON body, so a new reader adds one, the same reader adds
  nothing, and a body without an id records nothing.
- 2026-11-02: The article end matter no longer mounts a PDF download control.
  `PDFDownloadLink` renders its document the moment it mounts, so it built a
  PDF in every reader's browser to back a control with no visible glyph, and
  threw inside pdfkit (`Cannot read properties of null (reading 'write')`) on
  every article view. `@react-pdf/renderer` and `blog-document` stay installed:
  a download belongs on a server route that streams the file, not in the tab.
- 2026-11-02: The editor no longer has an Email section. The newsletter switch
  exists only on the profile's read view, so the "Turn it on or off on your
  profile" pointer it held is gone with it.
- 2026-11-02: The profile's settings that need no typing (topics, newsletter)
  are one row each under an "Account" heading, hairlines between rows, and the
  switch writes "On"/"Off" beside itself. The stray rule above "Edit profile" is
  gone (the header already ends in one), the profile's article actions moved up
  beside the name instead of a separate button row, and the editor's newsletter
  section points at the switch. Rules added to `DESIGN.md` under the account
  area.
- 2026-11-02: The newsletter switch sits on the profile itself, not behind
  "Edit profile". "The monthly roundup" reads as one row with its switch and
  saves on the press, so a member who wants to stop the email does not have to
  open a form to do it. The editor's Email section now points at that switch
  instead of holding a second one that could drift out of step.
- 2026-11-02: The handle in the profile editor is its own control. The profile
  form never carries a username: the field checks availability as typing
  settles, then **Change username** asks for one confirmation and saves through
  the API on its own press, so a refused handle cannot fail a profile save and a
  save cannot leave half an address behind. The field also shows "that address
  is free" before the press, not only refusals. The silent failure it replaces
  came from `THInput` spreading caller props over `register()`, which dropped
  the ref and sent no username at all.
- 2026-11-02: The member's own profile moved from `/profile/@<handle>` to
  `/profile`. The page describes whoever holds the session, so the address no
  longer carries a handle that goes stale on a rename; every link to it (nav
  menu, account rail, feed's topic links, settings card) is the constant
  `ownProfilePath`. The public page keeps the handle at `/users/<handle>`, which
  is what the share menu offers and the only profile address indexed. Old
  `/profile/@<handle>` and `/profile/<handle>` addresses are a permanent
  redirect to `/profile`.
- 2026-11-02: Usernames (#19). A handle step at `/welcome/username` before the
  topics step, with a free suggestion already filled in and the public address
  shown as it is typed. Changes from the profile wait 30 days from the last one
  (`usernameChangedAt`, computed, never stored), the onboarding step is exempt
  but starts the clock. Retired handles are kept in `username_history` for a
  year, refused to everyone, and answered with a permanent redirect from
  `/users/<old>` to `/users/<new>`. `pnpm migrate:username-onboarding` marked
  existing members as done.
- 2026-11-01: Per-article access (#8). The composer, both editors and the admin
  composer ask "who can read it" with two explained choices, stored on the
  article as `access` (`members` by default, so no migration and no behaviour
  change for older rows). A public article renders its whole body for a
  signed-out reader, has no members prompt, is canonical at `/blogs/<slug>`,
  and `?view=preview` redirects to that address. A members-only one behaves as
  before. The setting shows in the member list, the admin table and the
  moderation queue, and the sitemap and JSON-LD follow it.
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
- 2026-10-30: #11 fixed. `QueryBuilder` keeps a validated `status` for the three
  admin lists that opt in (newsletter subscribers, contact inbox, members);
  draft and deleted rows still cannot be asked for on a public list. Every
  admin list keeps its filters in the URL (`useAdminListParams`). The gate
  gained `query-filter`, a database-free check on the builder's visibility
  guard.
- 2026-10-30: A picked cover uploads at once through `POST /uploads/cover`
  (downscaled to 1600 px first) and its asset is deleted through
  `DELETE /uploads/asset` when it is replaced, removed, discarded or left
  behind, best effort; publish and edit send only the URL as JSON. The browser
  no longer calls `POST /uploads/signature`, so it is off the proxy allow list.
  Admin composer keeps the multipart path. Fixes issue #4 (the 1 MB Server
  Action "Body exceeded" toast).
- 2026-11-01: New article missing from the feed and titled "Article not found"
  fixed (#6). Publish is a Server Action, so its `updateTag`/`revalidatePath`
  actually run (they were silently ignored when `createBlog` ran in the browser);
  `POST /blogs` is on the proxy allow list and a route-handler publish calls
  `revalidateTag("allBlogs", { expire: 0 })` as a backstop. `generateMetadata`
  and the page body both resolve the article through `getArticlePage`, and a
  publish writes the article into its own version cache, so head and body
  describe one article even on the request that creates the page. A version the
  module has not remembered is no longer loaded blind: a cached miss from the
  build was being handed back as "no article".
- 2026-10-31: The cover strip's Remove always clears, with no `canRemove` gate:
  after a failed upload the writer was stuck on "upload failed" with nothing to
  remove. `textValue` added to the account menu's identity row and to the other
  items whose labels are not one plain string, which silences react-stately's
  `<Item>` warning on load.
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
