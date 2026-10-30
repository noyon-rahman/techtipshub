# Architecture

How the pieces fit and where a new piece belongs. Product scope is in
[`PRD.md`](./PRD.md), screen direction in [`DESIGN.md`](./DESIGN.md), working
conventions in [`Rules.md`](./Rules.md).

## Shape

A pnpm workspace driven by Turbo, two deployable apps and two shared packages.

```
techtipshub/
+- apps/web     Next.js 16 (App Router, React 19)   @techtipshub/web
+- apps/api     Hono on Node, Mongoose on MongoDB   @techtipshub/api
+- packages/shared            enums, wire shapes, envelope guards
+- packages/eslint-config     base / node / next flat configs
+- packages/typescript-config base / node / next tsconfig presets
```

The two apps are deployed separately. The web app never talks to MongoDB; the
API never renders HTML. The only contract between them is HTTP plus the types in
`packages/shared`.

```
browser --> Next app (server components, server actions, route handlers)
               |  fetch with bearer from the httpOnly cookie
               v
            Hono API  /api/v1/*  --> MongoDB (Mongoose)
               |
               +--> Resend (mail), Cloudinary (images)
```

## Request path

Three ways a browser request reaches data:

1. **Server render.** A page component calls a function in
   `apps/web/src/services/<domain>/`, which uses the server axios instance with
   `envConfig.baseApi` and attaches the access token from the cookie. Used by
   every page that can be rendered without a second round trip.
2. **Server action.** `"use server"` functions under `src/services/<domain>/`
   for writes that must not depend on CORS or the browser proxy (newsletter
   membership, the profile save, article access checks).
3. **Browser call.** Only for interactions after paint: votes, follow, view
   counting, infinite feed pages. These go through `apps/web/src/app/api/v1/[...path]/route.ts`,
   an **allowlisted** proxy that forwards to the API with the session attached.
   The list is a deliberate deny-by-default: adding a route to the API does not
   make it reachable from the browser.

Admin browser calls take the same shape under `app/api/admin/[...path]/route.ts`,
guarded by `proxy.ts` for the Admin role.

A mutation that mutates state through the browser proxy also passes a
same-origin check (`origin` host must equal `host`), so another site cannot
borrow a session with a form post.

## Sessions

There is no auth library. The API is the only authority on who is signed in.

- On sign-in the API sets two httpOnly cookies: `tth_access_token` and
  `tth_refresh_token` (`modules/auth/session-cookies.ts`). `sameSite: Lax`,
  `secure` in production, one year, so the API rather than the browser's clock
  decides when a session ends.
- `apps/web/src/lib/session.ts` asks `GET /auth/session` with the request's
  cookies and follows the answer. It does not decode a token, read an expiry or
  interpret a role. If the API renews the session it writes the new cookies
  when it can.
- `apps/web/src/proxy.ts` is a filter, not the gate. It redirects legacy
  addresses, sends crawlers to the article preview variant, renews cookies,
  and refuses `/admin` and `/api/admin` for a non-admin. Pages and server
  actions check the session again before acting.
- The API's `auth(...roles)` middleware re-reads the account on every call and
  refuses a deleted account, a blocked account, a token issued before the
  last password change, and a token whose `tokenVersion` is stale. Bumping
  `tokenVersion` is what makes "sign out everywhere", a password change and a
  password reset actually end a stolen refresh token.

Google sign-in is handled by the API (`/auth/google` then
`/auth/google/callback`, which redirects to the site with a handoff code that
`POST /auth/session/claim` exchanges), so the client secret never reaches the
web app. The handoff is stateless: a short-lived JWT signed with
`GOOGLE_STATE_SECRET` that carries the two tokens, so nothing temporary is
written to the database. Both apps read the same variable, which is why it is
in the web app's environment too.

## API inside

`apps/api/src`

| Area | Where |
| --- | --- |
| App wiring, CORS, DB connect per request | `app/app.ts`, `main.ts`, `server.ts` |
| Route tree, mounted under `/api/v1` | `routes/index.ts` |
| Modules | `modules/{auth,user,blog,category,comment,contact,follower,metrics,newsletter,view,vote,admin}` |
| Middleware | `middlewares/{auth,optionalAuth,validate,withUploads,rateLimit}.ts` |
| Parsed, boot-checked env | `config/env.ts` (zod; bad value stops the boot) |
| Error model | `errors/*`, `app/errorHandler.ts` |
| Query building | `builder/QueryBuilder.ts` (escaping, search terms, filters, pagination) |
| Mail | `config/mail.ts` + MJML templates in `emails/` |

Each module follows the same file split: `.routes.ts` (paths and middlewares),
`.controller.ts` (HTTP in, response out), `.service.ts` (queries and rules),
`.model.ts` (schema), `.validation.ts` (zod), `.interface.ts`/`.constant.ts`
(types and enums). `admin` is the exception: it composes other modules'
controllers and adds the admin-only service, log and route files.

Admin routes live under `/admin/*` and are guarded once
(`adminRouter.use("*", auth(ADMIN))`). Member routes keep their own paths. Where
one service serves both, the member path stays and the admin screens call an
explicit `/admin/...` variant so the admin's action can be logged with the
admin's identity (for example `DELETE /comments/:id` versus
`DELETE /admin/comments/:id`).

## Data model

MongoDB collections, all snake_case, each name pinned as the third argument of
its model call so a rename of the model cannot move the data. Field names that
predate the product's "blog" wording (`post`, `postCount`, `totalPosts`) keep
their stored spelling, because documents already hold them.

| Collection | Model | Notes |
| --- | --- | --- |
| `users` | `User` | role `User`/`Admin`, status `Active`/`Blocked`, `tokenVersion`, `googleId`, soft delete `isDeleted`, counted fields for followers/following/posts |
| `posts` | `Blog` (model named `Post`) | author, title, unique slug, contentType, content, cover, category, images, tags, `status` `draft`/`published`, `publishedAt`, counters for votes/comments/views, `isDeleted`, `createdBy` when an admin wrote it |
| `categories` | `Category` | slug and name, soft delete `isDeleted`; an admin adds them from the panel, a signed-in member can add one from the composer (`POST /categories`) |
| `comments` | `Comment` | on an article, optional images, counted on the article |
| `votes` | `Vote` | one per member per article, `upvote`/`downvote` |
| `followers` | `Follower` | follower to following, one row per pair |
| `views` | `View` | one per reader per article, guest id or member id |
| `contacts` | `Contact` | contact form, status `new`/`read`/`archived` |
| `newsletter_subscribers` | `NewsletterSubscriber` | status `active`/`unsubscribed`/`bounced`/`complained`, `suppressedAt`, source |
| `newsletter_campaigns` | `NewsletterCampaign` | status `draft`/`sending`/`sent`, frozen article copies, frozen `recipients[]` |
| `admin_logs` | `AdminLog` | who did what, never throws when the write fails |
| `payments` | `Payment` | stored receipts from the older billing build; no route writes them, the site takes no payments |
| `subscriptions` | `Subscription` | stored membership periods from the same build; no route writes them |

The Google sign-in handoff stores nothing of its own: no collection exists for
it, so nothing has to be cleaned up.

Indexes are built by Mongoose when an instance connects (`settings.autoIndex`,
left on), so the constraints the app relies on -- one vote per member, unique
slug -- do not wait for a deploy step. A collection older than the model that
now pins it needs its index before it is written to; `pnpm migrate:collections`
builds it. The same script moves documents from any collection still under a
name no model pins into its model's collection, and keeps the old rows.

Two soft-delete rules live in model middleware rather than in each query:
`pre("find")` and `pre("findOne")` add `isDeleted: { $ne: true }` unless the call
sets `bypassMiddleware`, and the blog model also hides drafts unless the call
sets `includeDrafts`. A new reader-facing query therefore hides trashed and
draft content without remembering to.

Counters on the article (votes, comments, views) are updated with the write that
causes them, not recomputed on read.

## Contracts

- **Success:** `{ data, meta? }`, `meta` is `{ page, limit, total, totalPages }`.
- **Error:** `{ error: { message, code?, details? } }`, codes
  `VALIDATION_ERROR`, `INVALID_ID`, `DUPLICATE_ENTRY`, `UNAUTHORIZED`, and so on.
- `packages/shared` holds the enums and the wire shapes both apps use, plus
  `isErrorEnvelope` for narrowing an unknown response.
- `apps/web/src/lib/api-contract.ts` (the axios instance in
  `lib/AxiosInstance/`) adapts the envelope to the client's
  `{ success, data, meta, message }` shape in one place, so pages never read two
  shapes.

Lists take `page`, `limit`, `sort`, `searchTerm` and filters through
`QueryBuilder`, which caps page size and escapes every search term before it
reaches Mongo.

## Web app inside

`apps/web/src`

| Area | Where |
| --- | --- |
| Routes | `app/(mainLayout)`, `app/(feedLayout)`, `app/(adminLayout)` |
| Browser API proxies | `app/api/v1`, `app/api/admin`, `app/api/views`, `app/api/auth/google` |
| Data access | `services/<domain>/` (+ `services/admin/*`) |
| Query hooks | `hooks/` one per domain, TanStack Query |
| Session and routing rules | `lib/session.ts`, `lib/blog-routes.ts`, `proxy.ts` |
| Client session context | `context/user.provider.tsx` |
| UI | `components/` by feature (`modules/*`) and by primitive (`ui/`, `shared/`) |
| Editor | `components/editor/*` (Tiptap 3) |
| Config | `config/{site,legal,ads,fonts,api,env.config}.ts` |
| Styles | `styles/globals.css` plus `tailwind.config.js` (HeroUI theme) |

Route groups, not middleware rewrites, decide the frame: `(feedLayout)` is the
feed shell with the right rail, `(mainLayout)` is the reading and account shell,
`(adminLayout)` is the admin rail. The composer and editor sit at the site root
so a writing page is not narrowed by the account rail.

One `QueryClient` lives in `providers/index.tsx`. Its `QueryCache.onError` keeps
stale data on a failed refetch rather than blanking the screen, and the
`LOCAL_WRITE` helpers let a vote or a follow show immediately and settle when
the server answers.

## Styling

Tailwind v4 through `@tailwindcss/postcss`, with HeroUI v2 as the component
base and the theme defined in `apps/web/tailwind.config.js`: amber primary, warm
neutral ramp, Fraunces for display and Inter for interface text, `darkMode:
"class"`, dark as the shipped default with a working toggle. Two utility
classes in `styles/globals.css` are rules rather than suggestions:
`.tth-label` for section labels and `.text-primary-accessible` for any amber
that is text or a hairline. Reasons for each choice are in `DESIGN.md`.

## Environments

- **Local:** `pnpm dev` starts both apps through Turbo. The API needs
  `.env.development` (`apps/api/.env.example` lists every key), the web app needs
  `BASE_API`/`NEXT_PUBLIC_BASE_API` pointing at it.
- **Production:** both apps on Vercel, `apps/api/src/config/env.ts` validated at
  boot. The API's CORS list is fixed in `app/app.ts`, so a new origin is a code
  change, not a dashboard setting.
- Mail and the newsletter degrade rather than fail: no `RESEND_API_KEY` means no
  mail, no `RESEND_WEBHOOK_SECRET` means the bounce endpoint answers 503.

## Decisions worth knowing

- **Hono, not Express.** One router shared by a Node server and Vercel Functions,
  with zod validation via `@hono/zod-validator`.
- **The site does not decode tokens.** One authority (the API), so a revoked
  session, a changed password and a role change take effect with no second
  implementation to keep in step.
- **Soft delete over hard delete for members and articles,** because a removed
  article still has comments and votes, and an admin needs to undo a removal.
- **The newsletter stores copies of the articles it names,** not references, so
  editing an article cannot rewrite an issue that already went out.
- **One test gate, not a spec suite.** `pnpm test` runs typecheck, the format
  and repository invariant checks (`scripts/test/checks/`), lint and a
  production build of both apps. The invariants read the tree, so they catch a
  placeholder that would ship, a route that forgot its roles and an env key
  Turbo does not know about; a unit runner that only covered pure helpers would
  pass while those broke. The gate is not yet wired into CI.
- **One Prettier config, at the root** (`prettier.config.mjs`,
  `.prettierignore`). Both apps format the same way; an app-level config is a
  second opinion and the format check rejects one.
