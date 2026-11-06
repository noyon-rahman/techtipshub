<!-- markdownlint-disable MD033 -->
<div align="center">

<img src="./apps/web/public/brand/logo-dark.svg" alt="TechTipsHub logo" height="96" />

# TechTipsHub

**A publishing site for developers: write in the browser, publish to the feed, and let readers vote, comment and follow.**

Practical writing on web development, AI and the tools modern developers use: tutorials, explainers and honest tool comparisons.

[![Live Site][badge-site]][site-url]
[![API][badge-api]][api-url]
[![License: MIT][badge-license]][license-url]
[![PRs Welcome][badge-prs]][prs-url]

[![Next.js][badge-next]][next-url]
[![React][badge-react]][react-url]
[![TypeScript][badge-ts]][ts-url]
[![Tailwind CSS][badge-tailwind]][tailwind-url]
[![HeroUI][badge-heroui]][heroui-url]
[![Hono][badge-hono]][hono-url]
[![Node.js][badge-node]][node-url]
[![MongoDB][badge-mongodb]][mongodb-url]
[![Mongoose][badge-mongoose]][mongoose-url]
[![pnpm][badge-pnpm]][pnpm-url]
[![Turborepo][badge-turbo]][turbo-url]
[![Vercel][badge-vercel]][vercel-url]

[Live site][site-url] · [API health][api-health-url] · [Product spec](./PRD.md) · [Architecture](./Architecture.md) · [Design](./DESIGN.md) · [Report a bug][issues-url]

</div>

---

## Table of contents

- [About](#about)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Install](#install)
  - [Environment variables](#environment-variables)
  - [Run in development](#run-in-development)
  - [Build for production](#build-for-production)
- [Available scripts](#available-scripts)
- [API overview](#api-overview)
- [Architecture at a glance](#architecture-at-a-glance)
- [Security model](#security-model)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project documents](#project-documents)
- [Contributing](#contributing)
- [License](#license)
- [Author](#author)

---

## About

TechTipsHub is a full-stack publishing platform for developers. A member writes an article in the browser, chooses who can read it, and publishes it to the feed. Readers sign in, upvote, comment and follow. Admins run the editorial and moderation side of the site from a dedicated panel, including a monthly newsletter roundup.

It is a **pnpm + Turborepo monorepo** with two separately deployed applications and two shared packages:

- **`apps/web`** — the Next.js 16 site (App Router, React 19, HeroUI, Tailwind CSS v4).
- **`apps/api`** — the Hono REST API on Node, backed by MongoDB through Mongoose.

The web app never talks to MongoDB, and the API never renders HTML. The only contract between them is HTTP plus the types in `packages/shared`.

### The one rule the product is built around

> A published article belongs to a signed-in reader, **unless its author says otherwise.**

Every article is set to **Everyone** or **Members only** in the composer, and the choice is stored with it. A members-only page is prerendered and served from the CDN, but the prose is only revealed after the browser proves it holds a session. A public article is the exception the author chose: its body ships in the document for everyone and its canonical address is the plain one.

## Features

<table>
<tr><td valign="top" width="50%">

### Readers

- Engagement-ranked and newest feeds with category filters and search
- Article pages with cover, code blocks, author block and related reading
- Per-article access control: everyone or members only
- Upvote / downvote, threaded comments, follow authors
- Unique-reader view counting (one count per reader per article)
- A `/following` feed of the people you follow

</td><td valign="top" width="50%">

### Writers

- Rich Tiptap 3 composer at `/blogs/new` with toolbar and slash commands
- Cover image upload, category, tags, title and slug
- Save as draft or publish; drafts never appear in reader queries
- Editor at `/blogs/<slug>/edit` that preserves slug, votes and comments
- Personal article list with live counters at `/profile/blogs`

</td></tr>
<tr><td valign="top" width="50%">

### Accounts

- Email + password with email verification, Google sign-in, reset flow
- One profile form for details, photo and social links
- Username onboarding with a 30-day change lock and old-handle redirects
- Session invalidation on password change or reset via `tokenVersion`

</td><td valign="top" width="50%">

### Admins

- Thirteen management screens under `/admin`
- Dashboard and analytics, all numbers from the API
- Moderation queue, comment and contact-message handling
- Article, category and member management, with block / promote / remove
- Trash with restore, and an activity log for every meaningful action
- Monthly newsletter builder that sends in batches of ten

</td></tr>
</table>

## Tech stack

| Layer | Technology |
| --- | --- |
| Monorepo | pnpm workspaces + Turborepo |
| Web framework | Next.js 16 (App Router), React 19 |
| UI | HeroUI v2, Tailwind CSS v4, Framer Motion, Recharts |
| Editor | Tiptap 3 (`@tiptap/react`, starter-kit, lowlight) |
| Client data | TanStack Query v5, React Hook Form + Zod, Axios |
| API framework | Hono 4 on Node (`@hono/node-server`) |
| Validation | Zod 4 via `@hono/zod-validator` |
| Database | MongoDB with Mongoose 8 |
| Auth | Stateless JWT sessions in httpOnly cookies (no auth library) |
| Mail | Resend (`mjml` templates) |
| Media | Cloudinary |
| Language | TypeScript |
| Tooling | ESLint (flat config), Prettier, `tsx` |
| Hosting | Vercel (both apps), MongoDB Atlas |

## Repository layout

```
techtipshub/
├── apps/
│   ├── web/                    # Next.js 16 site              @techtipshub/web
│   │   └── src/
│   │       ├── app/            # App Router: (main|feed|admin|welcome)Layout
│   │       ├── components/     # UI by feature and by primitive
│   │       ├── services/       # Server-side data access per domain
│   │       ├── hooks/          # TanStack Query hooks per domain
│   │       ├── lib/            # Session, routing, axios instance
│   │       └── config/         # site, legal, ads, fonts, api, env
│   └── api/                    # Hono REST API              @techtipshub/api
│       └── src/
│           ├── app/            # Hono app, error handler
│           ├── modules/        # auth, blog, comment, user, admin, ...
│           ├── middlewares/    # auth, rate limiting, validation
│           ├── db/             # MongoDB connection
│           └── emails/         # MJML templates
├── packages/
│   ├── shared/                 # Enums, wire shapes, envelope guards
│   ├── eslint-config/          # Shared flat ESLint configs
│   └── typescript-config/      # Shared tsconfig presets
├── docs/                       # admin-panel.md, newsletter.md
├── scripts/                    # Test runner and checks
├── PRD.md · Architecture.md · DESIGN.md · Rules.md · Phases.md · Memory.md
└── turbo.json · pnpm-workspace.yaml
```

## Getting started

### Prerequisites

- **Node.js** `>= 20` (the repo is developed and CI-checked on Node 22)
- **pnpm** `10.28.0` (enforced via `packageManager`; use `corepack enable`)
- A **MongoDB** database (local or Atlas)
- Optional: **Cloudinary** account for image uploads, **Resend** API key for mail

### Install

```bash
git clone https://github.com/noyonalways/techtipshub.git
cd techtipshub
pnpm install
```

### Environment variables

Each app reads its own env file. Copy the examples and fill them in.

```bash
cp apps/api/.env.example apps/api/.env.development
cp apps/web/.env.example apps/web/.env.development
```

**`apps/api/.env.development`** — every key is documented inline in the file. The essentials:

| Variable | Purpose |
| --- | --- |
| `PORT` | API port (default `5000`) |
| `DATABASE_URL` | MongoDB connection string |
| `API_BASE_URL` | Public base URL of the API, including `/api/v1` |
| `CLIENT_BASE_URL` | Base URL of the web app (used for redirects and mail links) |
| `JWT_ACCESS_TOKEN_SECRET` / `JWT_REFRESH_TOKEN_SECRET` | Session signing secrets |
| `JWT_RESET_PASSWORD_SECRET` | Password-reset token secret |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Image uploads |
| `RESEND_API_KEY` | Mail; leave empty to disable mail (the app degrades, it does not fail) |
| `MAIL_DOMAIN` / `MAIL_REPLY_TO` / `CONTACT_INBOX` | Sender and inbox addresses |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google sign-in; leave empty to disable |
| `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MINUTES` | Sign-in / signup rate limiting |
| `TRUST_PROXY` | Set `true` when the API sits behind a proxy (Vercel) |

**`apps/web/.env.development`** — a smaller set:

| Variable | Purpose |
| --- | --- |
| `BASE_API` | Server-side base URL of the API |
| `NEXT_PUBLIC_BASE_API` | Browser-reachable base URL of the API |
| `SITE_URL` | Public URL of the site |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact address shown on the site |
| `NEXT_PUBLIC_ADSENSE_ENABLED` | Toggle AdSense slots |

> **Never commit a real secret.** Only `.env.example` files are tracked; `.env*` files are git-ignored.

### Run in development

```bash
pnpm dev            # both apps through Turbo
pnpm dev:web        # web app only  → http://localhost:3000
pnpm dev:api        # API only      → http://localhost:5000
```

### Build for production

```bash
pnpm build          # Turbo builds every workspace in dependency order
pnpm start          # run the built apps
```

## Available scripts

Run from the repository root:

| Script | Description |
| --- | --- |
| `pnpm dev` | Start all apps in watch mode (Turbo) |
| `pnpm dev:web` | Start only `@techtipshub/web` |
| `pnpm dev:api` | Start only `@techtipshub/api` |
| `pnpm build` | Build all workspaces (respecting `^build` order) |
| `pnpm start` | Start the built apps |
| `pnpm lint` | Lint all workspaces |
| `pnpm typecheck` | Type-check all workspaces |
| `pnpm test` | Run the custom test runner (`scripts/test/run.mjs`) |
| `pnpm format` | Format the repo with Prettier |
| `pnpm format:check` | Verify formatting without writing |

API-only migrations (run from `apps/api`):

```bash
pnpm migrate:collections            # backfill collection names / indexes
pnpm migrate:username-onboarding    # mark pre-username accounts as onboarded
```

## API overview

The API is mounted at `/api/v1` and answers a consistent envelope:

```jsonc
// Success
{ "data": { /* ... */ }, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5 } }

// Error
{ "error": { "message": "…", "code": "VALIDATION_ERROR", "details": [/* … */] } }
```

Health check: `GET /health` → `OK✅`

| Prefix | Domain |
| --- | --- |
| `/api/v1/auth` | Sign-up, sign-in, Google OAuth, session, password reset |
| `/api/v1/users` | Profiles, follow, usernames, onboarding |
| `/api/v1/admin` | Admin panel operations |
| `/api/v1/categories` | Category listing and creation |
| `/api/v1/blogs` | Articles, feed, search, ranking |
| `/api/v1/comments` | Comments on articles |
| `/api/v1/metrics` | Dashboard and analytics numbers |
| `/api/v1/contact` | Contact-form submissions |
| `/api/v1/newsletter` | Subscriptions and campaign sending |
| `/api/v1/views` | Unique-reader view counting |
| `/api/v1/uploads` | Cloudinary cover uploads and deletes |

## Architecture at a glance

**Request path.** Browser requests reach data three ways:

1. **Server render** — page components call `services/<domain>/` using a server axios instance with the access token from the cookie.
2. **Server action** — `"use server"` functions for writes that must not depend on CORS (newsletter membership, profile save, article access checks).
3. **Browser call** — post-paint interactions (votes, follow, view counting, infinite feed pages) go through an **allowlisted** proxy at `app/api/v1/[...path]/route.ts`. Deny-by-default: adding an API route does not make it reachable from the browser.

**Sessions.** No auth library — the API is the only authority on who is signed in. On sign-in it sets two httpOnly cookies (`tth_access_token`, `tth_refresh_token`). The web app asks `GET /auth/session` and follows the answer; it never decodes a token. The API re-reads the account on every call and refuses a deleted account, a blocked account, a token issued before the last password change, or a token with a stale `tokenVersion`.

**Data model.** MongoDB collections use snake_case names pinned to each model. Soft delete (`isDeleted`) hides trashed members and articles via `pre("find")` middleware, and the blog model hides drafts unless a query opts in. Article counters (votes, comments, views) are updated with the write that causes them.

**Feed order.** One file decides it: `apps/api/src/modules/blog/blog.ranking.ts`. The default `sort=ranking` is an engagement score (upvotes ×4, comments ×5, views ×0.1, downvotes ×3 subtracted, plus a 45-day freshness window), personalized by the reader's chosen interests. `sort=newest` is publication order. Every order ends on `_id: -1` so offset paging never repeats a card.

See [`Architecture.md`](./Architecture.md) for the full walkthrough.

## Security model

- **One authority.** Only the API decides who is signed in; the web app never decodes or trusts a token on its own.
- **Cookie sessions.** `httpOnly`, `sameSite: Lax`, `secure` in production, one-year lifetime — the API, not the browser clock, decides when a session ends.
- **Session revocation.** Bumping `tokenVersion` makes "sign out everywhere", a password change and a reset actually invalidate a stolen refresh token.
- **Deny-by-default proxy.** The browser-to-API proxy is an allowlist; a same-origin check protects state-changing calls from cross-site form posts.
- **Role checks in two places.** `proxy.ts` refuses `/admin` for a non-admin, and the API's `auth(...roles)` middleware refuses it again.
- **Rate limiting** on sign-in, signup and Google-start attempts, with a `TRUST_PROXY` flag that must be set correctly in production.
- **Input validation** with Zod at every boundary; errors never leak internals.

## Testing

The repo ships a lightweight, dependency-free test runner plus targeted checks:

```bash
pnpm test
```

It runs `scripts/test/run.mjs`, which includes:

- **Format check** — Prettier compliance across the workspace.
- **Invariants** — structural rules the codebase must hold.
- **Query filter** — guarantees reader-facing queries hide drafts and trashed content.
- **Username onboarding** — the handle rules shared by API and web.

Individual scripts under `scripts/test/` can also be run directly with `tsx` / `node`.

## Deployment

Both apps deploy to **Vercel** as separate projects. The API validates its environment at boot (`apps/api/src/config/env.ts`) and ships a `vercel.json`.

- The API's CORS list is fixed in `apps/api/src/app/app.ts`, so a new allowed origin is a code change rather than a dashboard setting.
- Mail and the newsletter **degrade rather than fail**: no `RESEND_API_KEY` means no mail is sent; no `RESEND_WEBHOOK_SECRET` makes the bounce endpoint answer `503`.
- Set every required environment variable in each Vercel project (mirror the `.env.example` files).

## Project documents

The repo carries its own specification. Read the one that governs your work:

| File | Holds |
| --- | --- |
| [`PRD.md`](./PRD.md) | Who the product is for, what ships, what is deliberately out of scope |
| [`Architecture.md`](./Architecture.md) | Stack, request path, sessions, data model, where new code belongs |
| [`DESIGN.md`](./DESIGN.md) | Identity, palette, type, screen rules |
| [`Rules.md`](./Rules.md) | Conventions, definition of done, delivery gate |
| [`Phases.md`](./Phases.md) | Order of work and exit criteria |
| [`Memory.md`](./Memory.md) | Current state, open items, traps |
| [`docs/admin-panel.md`](./docs/admin-panel.md) | Every admin surface, in detail |
| [`docs/newsletter.md`](./docs/newsletter.md) | The newsletter feature, in detail |

## Contributing

1. Fork the repo and branch off `dev` (the default working branch is `main`; feature work lands on `dev`).
2. Install with `pnpm install` and add the required `.env` files.
3. Keep changes consistent with `Rules.md` and the surrounding code.
4. Before opening a PR, run the full local gate:

   ```bash
   pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
   ```

5. Open a pull request describing the change and referencing the governing document(s).

Found a bug or have a request? [Open an issue][issues-url].

## License

Released under the [MIT License](./apps/web/LICENSE).

## Author

**Noyon Rahman**

[![GitHub][badge-github]][author-github-url]

<!-- Reference links -->
[site-url]: https://techtipshub.vercel.app
[api-url]: https://api-techtipshub.vercel.app
[api-health-url]: https://api-techtipshub.vercel.app/health
[license-url]: ./apps/web/LICENSE
[prs-url]: https://github.com/noyonalways/techtipshub/pulls
[issues-url]: https://github.com/noyonalways/techtipshub/issues
[author-github-url]: https://github.com/noyonalways

[next-url]: https://nextjs.org
[react-url]: https://react.dev
[ts-url]: https://www.typescriptlang.org
[tailwind-url]: https://tailwindcss.com
[heroui-url]: https://www.heroui.com
[hono-url]: https://hono.dev
[node-url]: https://nodejs.org
[mongodb-url]: https://www.mongodb.com
[mongoose-url]: https://mongoosejs.com
[pnpm-url]: https://pnpm.io
[turbo-url]: https://turbo.build
[vercel-url]: https://vercel.com

<!-- Badges -->
[badge-site]: https://img.shields.io/badge/live-techtipshub.vercel.app-16a34a?logo=vercel&logoColor=white
[badge-api]: https://img.shields.io/badge/api-api--techtipshub-0ea5e9?logo=hono&logoColor=white
[badge-license]: https://img.shields.io/badge/license-MIT-blue
[badge-prs]: https://img.shields.io/badge/PRs-welcome-brightgreen

[badge-next]: https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white
[badge-react]: https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black
[badge-ts]: https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white
[badge-tailwind]: https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white
[badge-heroui]: https://img.shields.io/badge/HeroUI-2-000000?logo=react&logoColor=white
[badge-hono]: https://img.shields.io/badge/Hono-4-E36002?logo=hono&logoColor=white
[badge-node]: https://img.shields.io/badge/Node.js-%E2%89%A520-339933?logo=node.js&logoColor=white
[badge-mongodb]: https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb&logoColor=white
[badge-mongoose]: https://img.shields.io/badge/Mongoose-8-880000?logo=mongoose&logoColor=white
[badge-pnpm]: https://img.shields.io/badge/pnpm-10.28.0-F69220?logo=pnpm&logoColor=white
[badge-turbo]: https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white
[badge-vercel]: https://img.shields.io/badge/Deployed_on-Vercel-000000?logo=vercel&logoColor=white
[badge-github]: https://img.shields.io/badge/GitHub-noyonalways-181717?logo=github&logoColor=white
