# Phases

The order of work, what each phase hands over, and what must be true before the
next one starts. Phases 1 to 6 are complete. Current work is Phase 7; see
[`Memory.md`](./Memory.md) for the live open items.

A phase is done when its exit criteria hold, not when its tasks are ticked.
Record a finished phase in `Memory.md` and keep this file forward-looking.

## 1. Foundation - done

Workspace, shared packages, app shells, styling base, environment handling.

**Exit:** both apps start from `pnpm dev`, typecheck and lint pass, the theme
system and fonts load in both modes.

## 2. Accounts and sessions - done

Register, log in, log out, Google sign-in, forget and reset password, session
read through the API, cookie renewal, session revocation via `tokenVersion`.

**Exit:** a password change ends existing sessions; a blocked or deleted
account is refused by page, proxy and API; no token is readable from the
browser.

## 3. Publishing - done

Composer, editor, cover images on Cloudinary, categories, tags, drafts, publish,
member article list, permanent removal and restore.

**Exit:** a draft is invisible to every reader-facing query; editing a published
article keeps its slug, votes and comments.

## 4. Reading and community - done

Feed, following feed, search, category pages, article page with the gated body
and crawler preview, votes, comments, follow, view counting, profile pages.

**Exit:** the article body appears only for a session-holding browser while
crawlers still receive readable text and a canonical URL; one reader counts as
one view.

## 5. Admin panel - done

Thirteen screens, shared kit, role gating in the proxy and the API, activity log,
trash for articles and members, member detail.

**Exit:** a non-admin cannot reach `/admin` or `/api/admin`; every destructive
action confirms and states the effect on related data; each admin mutation lands
in the log.

## 6. Newsletter - done

Signup blocks, profile switch, subscriber list with statuses and CSV export,
issue builder with frozen copies, preview, test send, batched sending with claim
and lease, signed unsubscribe, Resend webhook suppression.

**Exit:** no address receives one issue twice under concurrent presses; a
bounced address is refused by every entry point; an issue is immutable once it
starts sending.

## 7. Hardening - in progress

Close the gaps that make the site hard to trust and hard to change.

1. Fill the legal entity and address in `config/legal.ts`.
2. Remove the dead SMTP/Nodemailer keys from `turbo.json`.
3. Resolve or remove `siteConfig.links`.
4. Introduce a test runner (Vitest, no browser) and cover, in this order: the
   newsletter batch claim and lease, the unsubscribe token, the `auth`
   middleware, the browser proxy allowlist.
5. Add one Prettier config at the root and run it once across the repo as its own
   commit.

**Exit:** `pnpm test` exists and runs in CI alongside typecheck, lint and build;
no `[PLACEHOLDER]` text remains in shipped copy; the repo has one formatting
config.

## 8. Performance and SEO - planned

Only start once Phase 7 is closed.

- Measure the feed and article pages before changing anything (light client
  bundle, image sizes from Cloudinary, font loading).
- Article structured data (Article/BreadcrumbList) checked against a real
  validator, not assumed.
- Sitemap and canonical coverage for category and profile pages.
- A view-count path that survives a burst of readers without a write per view.

**Exit:** recorded before and after numbers for the pages that changed; the
structured data validates cleanly.

## 9. Growth features - planned, not committed

Ideas with no design yet. Nothing here is promised; each one starts with a PRD
entry and a design pass, not with code.

- Tag pages and tag browsing.
- Article series (an ordered group of articles).
- Draft sharing with a read-only link.
- Notification digest for comments and follows.

## Rules for sequencing

- Finish the phase in front of you. A phase begun early is work done twice.
- A bug that blocks a live user jumps the queue; note the displacement in
  `Memory.md`.
- A phase that turns out to be larger than one screen gets split, not carried on
  half-finished.
