# Admin panel

Everything under `/admin` is rendered inside one shell (`src/app/(adminLayout)/layout.tsx`):
a grouped rail, a sticky top bar with global search, and a page frame that every
screen shares. The nav list lives in one place, `src/components/shared/admin-sidebar/admin-links.tsx`,
so the rail, the breadcrumb and the quick links cannot drift apart.

## Access

- `src/proxy.ts` refuses to render `/admin/*` unless the access token carries the
  Admin role, so a signed-in member cannot reach the shell at all. Renewing a
  token re-checks the renewed token, not the expired one.
- Every API route the panel calls is also guarded with `auth(USER_ROLE.ADMIN)`.
  The proxy is the door, the API is the lock.
- Old addresses redirect: `/admin` lands on the dashboard, and the old
  `/settings/admin*` screens land on the page that replaced them
  (`src/proxy.ts`, `LEGACY_REDIRECTS` / `LEGACY_EXACT`). The member-facing old
  addresses follow the same table: `/me/blogs*` → `/profile/blogs*`, and
  `/settings`, `/settings/manage-blogs` and `/me/blogs` → the member's own
  `/profile/@<handle>`, which is where the profile is now edited
  (`LEGACY_SETTINGS`). That table needs the session to know whose profile, so a
  signed-out visitor goes through the login redirect first. The composer and
  editor live beside the articles (`/blogs/new`, `/blogs/<slug>/edit`); the
  older `/write-blog`, `/profile/blogs/new` and `/profile/blogs/<slug>/edit`
  addresses redirect there (`LEGACY_EXACT` / `LEGACY_REDIRECTS`).
- A signed-out visitor asking for `/admin/*` is sent to `/login?redirect=/admin/...`
  rather than the home page, so the destination survives sign-in.

## Screens

| Screen        | Path                       | Question it answers                                         |
| ------------- | -------------------------- | ----------------------------------------------------------- |
| Dashboard     | `/admin/dashboard`         | How big is the site, and did anything move this month?      |
| Analytics     | `/admin/analytics`         | Is it growing, over a chosen range, and what is working?    |
| Moderation    | `/admin/moderation`        | What needs a decision right now?                            |
| Articles      | `/admin/manage-blogs`      | Where is one article, and how is it doing?                  |
| Comments      | `/admin/manage-comments`   | What are people saying, and what should go?                 |
| Categories    | `/admin/categories`        | What can authors publish under?                             |
| Members       | `/admin/manage-users`      | Who is here, and what is their standing?                    |
| Member detail | `/admin/manage-users/[id]` | What has this one person published and done?                |
| Messages      | `/admin/messages`          | What did the contact form send us, and has it been handled? |
| Newsletter    | `/admin/newsletter`        | Who gets the roundup, and what went out last month?         |
| Trash         | `/admin/trash`             | What did we remove, and does it need to come back?          |
| Activity log  | `/admin/activity-log`      | What have admins changed, and who did it?                   |

## Categories

`/admin/categories` lists every category with the number of published articles
filed under it, and splits out the unused ones, which are the only rows that can
be deleted. Members can ask for a category from the composer; a pending request
appears under **Requested** in the Categories manager, which only shows that tab
while something is waiting. Approving a request creates the live category
immediately and writes the decision to the activity log. Declining keeps the
request on record with an optional reason that only admins see.

## Shared kit

`src/components/modules/admin/kit/` holds the primitives every admin screen uses:
`StatTile`, `DataToolbar`, `DataTable`, `AdminPageHeader`, `AdminPagination`,
`ConfirmDialog`, `AdminActivityChart`. Use them instead of writing a new table or
a new card per screen: a change to density or to the hairline passes through once.

## Rules these screens follow

These come from `DESIGN.md` and apply to every admin page:

- Numbers come from the API. If a count is unknown it is missing from the screen,
  not zero, and never estimated.
- Every list has loading, error, empty and filtered-to-nothing states, each with
  its own next action.
- Destructive actions confirm and say what happens to related data.
- The API is the source of truth for permissions. The UI hides what a role cannot
  do, it never decides it.

## API surface

Every admin-only endpoint lives under `/admin` on the API (mounted under
`/api/v1`, behind `auth(USER_ROLE.ADMIN)`). There are no aliases on the shared
routes: a member-facing path (`/blogs`, `/comments/:id`, `/categories`, …) no
longer answers an admin call, so an admin screen calling one would get a 403
or fail outright.

| Area       | Endpoints                                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview   | `GET /admin/overview`, `GET /admin/search?q=`, `GET /admin/activity?days=`, `GET /admin/logs?limit=`                                                                                                             |
| Members    | `GET /admin/users`, `GET /admin/users/trash`, `PATCH /admin/users/:id/restore`, `PATCH /admin/users/:id/block`, `PATCH /admin/users/:id/unblock`, `PATCH /admin/users/:id/make-admin`, `DELETE /admin/users/:id` |
| Articles   | `GET /admin/blogs/trash`, `PATCH /admin/blogs/:id/restore`, `DELETE /admin/blogs/:id` (body `{ reason }`), `PUT /admin/blogs/:id` (multipart `data` + optional `image`)                                          |
| Categories | `GET /admin/categories`, `POST /admin/categories`, `PATCH /admin/categories/:id`, `DELETE /admin/categories/:id`                                                                                                 |
| Comments   | `GET /admin/comments`, `GET /admin/comments/latest`, `GET /admin/comments/counts`, `DELETE /admin/comments/:id`                                                                                                  |
| Messages   | `GET /admin/messages`, `GET /admin/messages/:id`, `PATCH /admin/messages/:id/status`                                                                                                                             |
| Newsletter | `GET/POST /admin/newsletter/subscribers`, `GET /admin/newsletter/subscribers/:id`, `POST /admin/newsletter/subscribers/unsubscribe`, `GET /admin/newsletter/subscribers/export`                                     |
| Roundups   | `GET/POST /admin/newsletter/campaigns`, `GET/PUT/DELETE /admin/newsletter/campaigns/:id`, `GET …/suggestion`, `GET …/preview`, `GET …/progress`, `POST …/test`, `POST …/start`, `POST …/continue`                 |

Shared routes the panel still uses, unchanged and not admin-only:

- `/blogs`, `/blogs/:slug`, `/blogs/:id/vote`, `/blogs/:id/comments`
- `/users/:username`, the follow endpoints, `/users/update-profile`,
  `/users/profile/update-social-links`
- `POST /contact` (the public form), `/auth/*`, `/views/*`, `/metrics/dashboard`
- `DELETE /comments/:id` and `PUT /comments/:id` (the comment's own author)
- `/newsletter/*`: the signup form, the unsubscribe link and the Resend webhook.
  The roundup itself is documented in `docs/newsletter.md`.

Where a service function serves both a member flow and an admin screen, the
member one keeps the shared path and the admin screens call the explicit
variant: `DELETE /comments/:id` stays shared, the moderation screens call
`DELETE /admin/comments/:id`, which records the admin in the activity log.

Client services: `src/services/admin/*` (categories, comments, members,
messages, newsletter, trash, overview, activity), the admin mutations in
`src/services/user/index.ts`, and the admin entries in
`src/services/blog/index.ts`.

Admin changes that matter (article removal and restore, member block, unblock,
promotion, removal and restore, comment removal, category changes, message
handling, newsletter additions, issue edits, sends and subscriber removals) are
written to the admin log by `admin-log.service.ts`. Logging never throws: a
failed log line must not fail the action it describes.
