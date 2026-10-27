# Rules

How work happens in this repository. Conventions, not suggestions, with one
exception marked below. Product scope is in [`PRD.md`](./PRD.md), layout in
[`Architecture.md`](./Architecture.md).

## 1. Read before you build

Before touching a feature, read the file that governs it:

| You are about to | Read first |
| --- | --- |
| Change any UI | [`DESIGN.md`](./DESIGN.md), then the antislop skills (section 2) |
| Write or change copy | `DESIGN.md` and `.agents/skills/antislop-copywriting/SKILL.md` |
| Add or change an admin screen | [`docs/admin-panel.md`](./docs/admin-panel.md) |
| Touch the newsletter | [`docs/newsletter.md`](./docs/newsletter.md) |
| Add a route, model or module | `Architecture.md` |
| Start a phase | [`Phases.md`](./Phases.md), then update [`Memory.md`](./Memory.md) when it is done |
| Write Next.js code | `apps/web/AGENTS.md`. This Next version differs from what you may know; read the guide in `apps/web/node_modules/next/dist/docs/` before writing |

## 2. The design filter

`AGENTS.md` (and `CLAUDE.md` for Claude) require the antislop skills on any UI,
copy, people, mobile-layout or code-comment work. The core filter always
applies; the specialised ones load with it.

- **Direction comes from `DESIGN.md`, not from the model.** Dials are
  `ENERGY 1 / RHYTHM 2 / MOTION 1`. If a direction file asks for something the
  filter forbids, name the element and the rule and ask the owner, do not
  silently obey or silently override.
- **Every decision gets a one-line reason.** Colour, layout, type, spacing,
  whether something is a card. If the reason cannot be written, the decision is
  not valid.
- **No invented assets.** No logo, avatar, statistic, testimonial or nav item
  without instruction. A placeholder is written as one (`[REAL DATA]`,
  "Coming soon"), never disguised as final.
- **No em dash in any text we write.** Use a period, comma, colon or parentheses.
- **Run the Delivery Gate before delivering** and report it as PASS/FAIL lines
  with evidence. A failed gate is not shipped. The full gate is in
  `.agents/skills/antislop/SKILL.md`, Delivery Gate.

## 3. Code conventions

### Both apps

- TypeScript strict, no `any` without a written reason. Shared types come from
  `packages/shared`, not from a copy.
- Follow the naming already in the file you are editing. The codebase uses
  `I`-prefixed interfaces, `T`-prefixed type aliases, and plain camelCase for
  exported values (`USER_ROLE`, `siteConfig`).
- Comments explain why, never what. If the code needs a comment to say what it
  does, rename something instead.

### API (`apps/api`)

- One module per domain, five files: `.routes`, `.controller`, `.service`,
  `.model`, `.validation` (plus `.interface`/`.constant` when needed). A route
  file holds paths and middleware only; a controller holds no queries.
- Every input is validated with zod through `validate(...)` before the handler
  runs. Query params too, not just bodies.
- Every authenticated route names its roles: `auth(USER_ROLE.USER)` or
  `auth(USER_ROLE.ADMIN)`. A route with a bare `auth()` is a bug.
- List routes go through `QueryBuilder`. Never interpolate a search string into
  a regex without `escapeRegex`.
- Literal paths are registered above `/:id` and `/:slug` routes.
- Admin mutations write to the activity log via `admin-log.service.ts`. Logging
  never throws: a failed log line must not fail the action it describes.
- Errors are thrown as `AppError`; the single error handler shapes the body.
  Never `c.json(..., 500)` from inside a service.
- Reader-facing queries rely on the model's soft-delete and draft filters. Use
  `bypassMiddleware` / `includeDrafts` only where the call really means "any
  state", and say why in a comment.

### Web (`apps/web`)

- Server components by default. `"use client"` only on the component that needs
  state, effects or browser APIs, pushed as low in the tree as possible.
- Data access in `services/<domain>/`; hooks in `hooks/`; no `fetch` or axios
  call inside a component.
- Writes that must not depend on CORS or the browser proxy are server actions
  (`"use server"`). A browser call goes through the allowlisted proxy; adding a
  path to that list is a security change, not a convenience.
- Every URL shape lives in one helper: `lib/blog-routes.ts` for the account area
  and editor, `lib/blog-routes.ts` and `proxy.ts` for legacy redirects. Never
  hard-code a route string in a component.
- Every data view has four states: loading (skeleton, matching the final
  layout), error (with a retry), empty, filtered-to-nothing. Three of them are
  different screens with different next actions.
- Mutations invalidate or update the exact query keys they affect. Optimistic
  writes use the `LOCAL_WRITE` helpers in `providers/index.tsx`, and roll back
  on failure.

### Admin screens

- Use the kit in `components/modules/admin/kit/` (`StatTile`, `DataToolbar`,
  `DataTable`, `AdminPageHeader`, `AdminPagination`, `ConfirmDialog`,
  `AdminActivityChart`) instead of writing a new table or card. A density change
  passes through once.
- The nav list lives in `components/shared/admin-sidebar/admin-links.tsx` only.
  The rail, breadcrumb and quick links read it.
- The UI hides what a role cannot do; it never decides permissions. The API is
  the source of truth.

### Styling

- Section labels use `.tth-label` (13px, 500, muted) or `.tth-label-sm`. Do not
  hand-roll an uppercase label.
- Amber text or a hairline uses `.text-primary-accessible`, never
  `text-primary-700` by hand and never a raw hex. `bg-primary` is for fills and
  the 2px current-state rule.
- Separation is a 1px hairline and space. A card gets a border only when it is a
  discrete, selectable object in a list.
- Radius: 6px controls, 10px media and panels, pill only for a removable tag
  chip.
- Motion is hover, focus and state only. No entrance animation, no scroll
  reveal, no pulsing.
- Everything ships in light and dark, at 360px, and keyboard-only.

## 4. Writing conventions

- Sentence case everywhere, including buttons and nav ("Sign up", "Log in").
- One plain sentence beats three clever ones. "We'll email you new articles.
  Unsubscribe any time." is the bar.
- Copy in a component is not a placeholder for later copy. If the sentence is
  not known, do not ship the element.
- A public form never reveals whether an address exists (signup says the same
  thing for every outcome).
- Numbers on a screen come from the API. Unknown means absent, never zero and
  never estimated.

## 5. Data and privacy rules

- The address a mail reaches, the token that unsubscribes it, and the id behind
  it are never shown together. Exports carry no ids and no tokens.
- A suppressed address (bounced or complained) is refused everywhere and
  reinstated by nothing. Mailing it is what damages the sending domain.
- The browser never reads a session token. No token in `localStorage`, no token
  in a client component prop.
- A `?redirect=` value is only honoured when it is a same-origin path
  (`safeRedirectPath`).

## 6. Environment and secrets

- Every key is listed in `.env.example` for its app. A new variable means a row
  in that file and in `turbo.json` `globalEnv` if build output depends on it.
  The stale SMTP and Nodemailer names currently in `turbo.json` are a cleanup
  task (`Phases.md`).
- The API validates env at boot and refuses to start on a bad value. Never add a
  silent fallback for a required key.
- Optional features fail soft and say so: no `RESEND_API_KEY` means no mail, no
  `RESEND_WEBHOOK_SECRET` means the bounce endpoint answers 503.
- Bucket and account ids (AdSense client, GA tag, Cloudinary cloud) live in
  `config/`, not scattered in components.

## 7. Git

- Branch names: `feat/<topic>`, `fix/<topic>`, `docs/<topic>`, `chore/<topic>`.
- Commits follow the history's style: `feat:`, `fix:`, `refactor:`, `docs:`,
  one line, imperative, lowercase after the colon.
- One commit is one change a reviewer can read. A refactor and the feature it
  enables are two commits.
- Do not commit `.env*`, `.next`, `dist` or generated brand files that the
  README marks as generated.

## 8. Definition of done

Before calling work finished, all of these hold:

1. `pnpm test` passes at the root. It runs typecheck, the format and invariant
   checks, lint and both builds, and stops at the first failure; `pnpm build`
   alone is not enough.
2. Every interactive element was clicked and its result recorded, element by
   element (`Rules.md`, Delivery Gate R-35). A claim without the recorded list is
   not a pass.
3. Both themes, 360px width and keyboard-only were exercised.
4. Every data screen shows loading, error, empty and filtered-to-nothing.
5. Admin actions appear in the activity log.
6. The relevant doc was updated: `Memory.md` for state, `Phases.md` for a
   finished phase, `docs/*.md` for a changed surface.
7. The Delivery Gate was reported as PASS/FAIL lines with evidence.

## 9. The one exception

`DESIGN.md` is the owner's direction and can change its own choices (palette,
type, dials) without asking the agent. Everything else in this file is a
convention for the agent: a change to it is a decision the owner makes, not a
cleanup the agent performs mid-task. If a rule blocks good work, say which rule
and why, and let the owner change the rule.
