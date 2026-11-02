# PRD

What TechTips Hub is, who it is for, and what has shipped. Product surface only:
screens and behaviour live in [`Architecture.md`](./Architecture.md), visual
direction in [`DESIGN.md`](./DESIGN.md), how we work in
[`Rules.md`](./Rules.md), current state in [`Memory.md`](./Memory.md), order of
work in [`Phases.md`](./Phases.md).

## What it is

A publishing site for developers. A member writes an article in the browser,
publishes it to the feed, and readers upvote, comment and follow. An admin area
runs the editorial and moderation side of the site, including a monthly
newsletter roundup.

The sentence the site ships with: "Practical writing on web development, AI and
the tools modern developers use: tutorials, explainers and honest tool
comparisons." (`apps/web/src/config/site.ts`).

## Who it is for

| Person | What they come for | What they get |
| --- | --- | --- |
| Reader (signed out) | Find something useful to read | Feed, search, categories, article preview, legal pages |
| Member (signed in) | Read the full article, vote, comment, follow | Article body, votes, comments, follow, their own profile and article list |
| Writer (any member) | Publish | Composer at `/blogs/new`, draft and publish, edit at `/blogs/<slug>/edit` |
| Admin | Keep the site correct | Dashboard, moderation, articles, comments, categories, members, messages, newsletter, trash, activity log, analytics |

There is one account type with a role flag (`User` or `Admin`), not separate
products. An admin is also a member and can publish.

## The one rule the product is built around

**A published article belongs to a signed-in reader, unless its author says
otherwise.** Every article is set to "Everyone" or "Members only" in the
composer, and the choice is stored with it (a row written before the setting
existed is members only). The page is prerendered and served from the CDN, so
anyone can be handed the shell; on a members-only article the prose is only
revealed after the browser proves it has a session
(`services/blog/article-access.ts`), and crawlers are redirected to a
server-rendered preview variant by `proxy.ts`. A public article is the
exception the author chose: its body is in the document for everyone, its
canonical address is the plain one, and the preview variant redirects to it.
This is a product decision, not a technical one, and it shapes the reader
journey below.

## Jobs and what ships for them

### 1. Read a good article

- Feed at `/` with cards, filters by category and search.
- Article at `/blogs/<slug>`: cover, title, body, code blocks, author block,
  vote, comments, related reading, newsletter signup, and a view counter that
  counts one reader once (`/views/:slug`).
- On a members-only article, signed-out readers see the opening and are asked
  to sign in for the rest. On a public one they read the whole thing.
- `/following` shows articles from the members you follow.

**Done when:** a members-only body appears only for a session-holding browser,
a public body appears for everyone and is indexed at `/blogs/<slug>`, the
crawler variant of a members-only article carries the real text and canonical
URL, a view is counted once per reader, and the page holds at 360px.

### 2. Write and publish

- Composer at `/blogs/new`: Tiptap editor with a toolbar, slash commands, links,
  images, code blocks, cover image, category, tags, title and slug.
- Two outcomes: save as draft or publish. Drafts never appear in any
  reader-facing query (`blog.model.ts` filters them out by default).
- Editor at `/blogs/<slug>/edit`, same surface, plus the article's numbers.
- The writer's list at `/profile/blogs`: rows with title, category, date and the
  counters, with Edit on every row and removal kept quieter.

**Done when:** a draft is invisible to readers, publishing stamps
`publishedAt` once, and editing a live article leaves its slug, votes and
comments intact.

### 3. Belong to the site

- Sign up, log in, sign in with Google, forget and reset password.
- Profile at `/profile`, which is also the edit screen: one form writes
  the details, photo and social links.
- Follow and unfollow from a member's page or the article author block.
- Comment on an article, edit or remove your own comment.

**Done when:** a password change or reset ends every existing session
(`tokenVersion`), a blocked account is refused everywhere, and the profile edit
writes in one save rather than per field.

### 4. Run the site (admin)

Thirteen screens under `/admin`, documented one by one in
[`docs/admin-panel.md`](./docs/admin-panel.md). The PRD cares about the jobs:

- **Is the site healthy?** Dashboard and analytics, numbers from the API only.
- **What needs a decision?** Moderation queue, comments, contact messages.
- **Where is one article and how is it doing?** Article list, one editor per
  article, an admin composer for writing on a member's behalf.
- **Who is here?** Members list, one member's detail page, block, promote,
  remove and restore.
- **What did we remove?** Trash for articles and members, with restore.
- **Who changed what?** Activity log for every admin action that matters.

**Done when:** the proxy and the API both refuse a non-admin, every destructive
action confirms and says what happens to related data, and each mutation lands
in the activity log.

### 5. Send the monthly roundup

A newsletter that names articles the site already has. Documented in
[`docs/newsletter.md`](./docs/newsletter.md).

- Signup blocks in the footer, the feed rail, the contact page and after an
  article. Single opt-in, one plain sentence, no second button.
- Profile switch that shows whether a member is on the list.
- Admin Issue builder: subject, preview line, heading, intro, up to 40 articles
  in a chosen order, previewed through the real template.
- Sending runs in batches of ten on an admin press, because the deployment plan
  does not allow the short cron interval the queue used to need.
- Bounces and complaints from Resend suppress the address permanently.
- Unsubscribe links are signed and work without a login.

**Done when:** the issue list is frozen at send time, no address gets the same
issue twice, and a bounced address is never mailed again.

## Out of scope

These are deliberate, not pending:

- No payments. `/refund-policy` exists to say so.
- No email verification gate on signup. Google accounts arrive verified; a
  password account can be created and used straight away.
- No scheduled sending. See the batch model above.
- No public account deletion flow. A member asks through the contact form and an
  admin removes the account.

## Non-negotiables

These come from `DESIGN.md` and apply to every feature:

- No fabricated numbers, excerpts or people. A count the API does not know is
  missing from the screen, not zero.
- Every control does something or is not shipped.
- Every data screen has four states: loading, error, empty, filtered-to-nothing,
  each with its own next action.
- Light and dark both work.
- Keyboard reachable, visible focus, 44px targets, nothing overflows at 360px.

## How we know a feature is done

A feature is done when the screen, the API route behind it and the permission
check all exist, the four states are designed, it writes to the activity log
when it is an admin action, and the click-through is recorded
(`Rules.md`, Delivery Gate). A screen with no route behind it is not done. A
route with no screen is not done either.
