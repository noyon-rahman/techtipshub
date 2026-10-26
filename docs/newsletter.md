# Newsletter

A monthly roundup of articles the site already has, sent to a list readers join
themselves. Three parts: the list, the issues, and the sending.

- **List** lives in `newslettersubscribers` (`apps/api/src/modules/newsletter/newsletter-subscriber.service.ts`).
- **Issues** live in `newslettercampaigns` (`newsletter-campaign.service.ts`).
- **Sending** goes through Resend as the `newsletter@` sender, in batches.

Nothing here is a free-form mail merge: an issue names articles, and the
template in `emails/newsletter-campaign.ts` decides the layout. Every issue
therefore looks like every other one, and a typo in one cannot break the HTML of
the next.

## Joining the list

Single opt-in, on purpose. A reader who gives an address gets the welcome mail
and the next issue; no confirmation step stands between the two.

| Where              | Component                                        |
| ------------------ | ------------------------------------------------ |
| Footer, sitewide   | `components/modules/newsletter/newsletter-signup.tsx` |
| Feed right rail    | same component, `layout="stack"`                 |
| Contact page       | same component                                   |
| End of an article  | same component, `layout="inline"`                |
| Profile edit form  | `newsletter-switch.tsx`                          |

The form asks for a first name and an address, and says what it will do with
them: "We'll email you new articles. Unsubscribe any time." with a link to
`/privacy`. There is no pre-ticked box and no second address field.

The profile switch is the same list record. It reads
`GET /newsletter/membership` on mount, so a member who already joined from the
footer sees it **on**, and it writes `PUT /newsletter/membership` with
`{ subscribed }`. Both routes need a session; the web app reaches them through
server actions (`services/newsletter/actions.ts`) because the API answers a
fixed CORS list and the browser's axios client rewrites `/admin*` paths.

### What the signup form never says

`POST /newsletter` answers the same words for every outcome: a new address, one
that is already on the list, one that unsubscribed earlier, one that bounced.
A public form that reports "already subscribed" is a way to test whether a
given address is a customer, so it does not.

### Suppression

Resend posts `email.bounced` and `email.complained` to
`POST /newsletter/webhook/resend`. The handler verifies the Svix signature
against the raw body, then moves the address to `bounced` or `complained` and
stamps `suppressedAt` / `suppressReason`.

A suppressed address is refused everywhere:

- the signup form answers its usual friendly line and sends nothing;
- the admin add says which suppression blocked it;
- the profile switch shows why it cannot be turned on.

Nothing reinstates it. Mailing an address that bounced is what damages the
sending domain, and the list is worth less than the domain.

## Unsubscribing

Every message carries a visible link in the footer and the two headers a
mailbox reads:

```
List-Unsubscribe: <https://<site>/unsubscribe?email=…&token=…>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

The link opens `/unsubscribe?email=…&token=…`. The page verifies the token, then
removes the address straight away and says whose address it was. Arriving at
the page is treated as intent, because a mailbox that prefetches the URL is
reporting the reader pressing the button in the client.

The token is an HMAC-SHA256 of the normalised address, base64url, first 32
characters (`newsletter.tokens.ts`). It is not stored, so nothing is looked up
before a forged link is rejected. The key is `NEWSLETTER_UNSUBSCRIBE_SECRET` when
set, otherwise derived from the JWT secrets. **Changing either key invalidates
every link already in a mailbox.**

`GET /newsletter/unsubscribe` only checks the link and echoes the address;
`POST /newsletter/unsubscribe` does the removal. The page calls the second once
the first confirms, and offers a retry button if that call fails.

## Building an issue

`/admin/newsletter` → **Issues** → **New issue**.

A new issue opens pre-filled from `GET /admin/newsletter/campaigns/suggestion`:

- **Heading**: the current month, e.g. "October 2026".
- **Articles**: everything published since the last issue that actually started
  sending, newest first. Before the first send that is every article, which is
  how the launch issue works.

The builder has four fields and one list:

| Field        | Limit | Notes                                     |
| ------------ | ----- | ----------------------------------------- |
| Subject      | 150   | The one line in the inbox.                |
| Preview line | 140   | The grey line under it, where shown.      |
| Heading      | 120   | The first line inside the message.        |
| Intro        | 2000  | A short note above the first article.     |
| Articles     | 40    | Picked in order; the order is the order.  |

Article entries are **copies**, not references: title, link, excerpt, cover
image and category are frozen when the draft is saved. Editing an article later
does not change an issue that already named it.

Drafts are editable and deletable. Once sending starts, both are refused: what
went to a reader's inbox cannot be edited afterwards.

### Preview and test

- **Preview** renders the saved copy through the same template the send uses,
  into an iframe. The opt-out link is switched off there: the preview address is
  a sample, and real links are signed per reader.
- **Send me a test copy** mails one message to the signed-in admin, with
  `replyTo` set to their own address and no `List-Unsubscribe` header. A test is
  not a subscription, and a reader who reports it must not take the domain down
  with it.

A new issue is saved as a draft the first time either is pressed.

## Sending

Start is a two-step confirmation that says how many people it reaches.
`POST /admin/newsletter/campaigns/:id/start` then:

1. refuses with a 409 if the active list is empty;
2. freezes the active list into the campaign (`recipients[]`), so a signup or an
   unsubscribe that arrives mid-send does not change who this issue reaches;
3. marks the campaign `sending` and processes the first batch of ten.

The rest drains on its own:

| Trigger                | Endpoint                                   |
| ---------------------- | ------------------------------------------ |
| Vercel Cron, every 5m  | `GET /api/v1/newsletter/cron`              |
| The admin's "Continue" | `POST /admin/newsletter/campaigns/:id/continue` |

Both call the same `processBatch`. It claims one recipient at a time with a
conditional update (pending → `sending`), so two ticks cannot take the same slot
and no address is mailed twice. A slot left in `sending` by a crashed tick is
released after a 5 minute lease. Each mail carries the idempotency key
`campaign-<id>-<address>`; a recipient gets 3 attempts.

While an issue is `sending`, the admin page polls
`GET /admin/newsletter/campaigns/:id/progress` every 5 seconds and stops when the
API reports `sent`. A finished campaign drops its `recipients` array and keeps
the counts.

`GET /admin/newsletter/campaigns/:id/preview` re-renders the stored copy.

## Environment

All three are optional. The feature runs without them, with the gaps noted.

| Variable                        | Effect when unset                                                        |
| ------------------------------- | ------------------------------------------------------------------------ |
| `NEWSLETTER_UNSUBSCRIBE_SECRET` | Key derived from the JWT secrets. Fine, but rotating the JWT secrets kills every link already sent. |
| `RESEND_WEBHOOK_SECRET`         | `POST /newsletter/webhook/resend` answers 503; bounces never arrive, so suppressed addresses keep being mailed. |
| `CRON_SECRET`                   | The cron endpoint answers 401; an admin drains each issue with **Continue**. |

Also required, and already used by the rest of the mail stack: `RESEND_API_KEY`,
`MAIL_DOMAIN` (the `newsletter@` local part sits on it) and `CLIENT_BASE_URL`
(the unsubscribe links point at the site). `MAIL_REPLY_TO` decides where a reply
lands; every campaign sets it explicitly.

### Setting up Resend

1. Verify the domain in Resend, so `newsletter@<MAIL_DOMAIN>` can send.
2. Add a webhook to `<API_BASE_URL>/newsletter/webhook/resend`, subscribed to
   `email.bounced` and `email.complained`. Copy the signing secret (`whsec_…`)
   into `RESEND_WEBHOOK_SECRET`.
3. Add `CRON_SECRET` to the API's environment; Vercel Cron sends it as
   `Authorization: Bearer` from `apps/api/vercel.json`.

## The admin screen

Two tabs under `/admin/newsletter`:

**Issues** lists every issue, newest first, with status, delivery counts and
when it started. A row opens the draft, the send in progress, or the record.

**Subscribers** lists the people:

- status tabs with counts for the whole list (active, unsubscribed, bounced,
  reported spam), not just the page;
- search on name and address, server-side paging;
- **Add subscriber**: name, address, and whether to send the welcome mail;
- **Remove**: the same act as the reader's own link, confirmed first;
- **Export CSV**: name, address, status, source and dates. No ids, no tokens,
  nothing that would let someone act on a subscriber's behalf.

## Web surface
| Path                                  | Purpose                                      |
| ------------------------------------- | -------------------------------------------- |
| `POST /newsletter`                    | Public signup, rate limited                  |
| `GET` / `POST /newsletter/unsubscribe`| Verify a link, then remove the address       |
| `GET` / `PUT /newsletter/membership`  | The profile switch (session required)        |
| `POST /newsletter/webhook/resend`     | Signature-verified bounces and complaints    |
| `GET /newsletter/cron`                | The scheduler's batch tick                   |

Admin endpoints under `/admin/newsletter/*` are listed in
[`admin-panel.md`](./admin-panel.md).

## Tests and checks

```bash
pnpm --filter @techtipshub/api typecheck
pnpm --filter @techtipshub/api lint
pnpm --filter @techtipshub/web typecheck
pnpm --filter @techtipshub/web lint
```

Before a real send: press **Send me a test copy** and open it on a phone and in
a desktop client, and follow its unsubscribe link once with an address you do
not mind removing.
