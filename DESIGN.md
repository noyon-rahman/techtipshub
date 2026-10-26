# DESIGN.md

Direction for TechTips Hub. Written by the product owner via the answers below,
transcribed by the agent. This file holds design direction only; the antislop
skill is the filter applied on top of it.

## Identity

TechTips Hub is where developers publish practical writing about web
development, AI and the tools they use daily. The article screens are where that
writing happens, so they are the part of the product that must feel most like a
tool and least like a template.

**Personality: measured, technical.** Calm, dense, utilitarian. The reference
feeling is documentation you trust, not a marketing surface. The interface
should recede; the writing is the only thing allowed to command attention.

## Dials

`Dial: ENERGY 1 / RHYTHM 2 / MOTION 1`

- **ENERGY 1.** Quiet surfaces, no decoration, no gradient, no glow. Nothing on
  the screen says hello; everything on it says what it does.
- **RHYTHM 2.** One consistent structure with a few deliberate breaks. The
  screens share a frame (bar, column, details, actions). Variation appears only
  where the content genuinely differs: a short list is not laid out like a long
  one, and an empty account does not pretend to be a full one.
- **MOTION 1.** Hover, focus and state transitions only. No entrance animation,
  no scroll reveal, no pulsing indicators.

## Palette

Warm neutral base plus **one accent: amber**. Replaced the stock HeroUI blue,
which read as a default rather than a decision and tinted every border cool
against the warm prose.

| Token | Hex | Use |
| --- | --- | --- |
| Amber (primary) | `#F2A93B` | Fill for primary actions, the logo tile, the 2px current-state rule |
| Amber, hover | `#E3961F` | Hover and `focus` on primary surfaces |
| Amber 700 | `#9C600C` | Any amber that is **text or a thin line on paper** (links, labels, numbers) |
| Ink | `#141315` | Dark background, letterform inside the tile |
| Paper | `#FCFAF6` | Light background |

Reason each is where it is:

- **Fill vs text split.** `#F2A93B` on paper is 1.9:1, fine behind dark ink and
  unusable as type. So text and hairline links use amber 700 (4.9:1 on paper,
  4.6:1 on `content2`), and the light amber is allowed only as a fill or a
  2px rule. In dark mode amber 400 sits at 9.3:1 on the background, so the same
  `text-primary-700` utility resolves to a dark-theme amber through the theme
  rather than a fixed hex.
- **Primary buttons keep dark ink.** `primary-foreground` is `#1E1B17`, 9:1 on
  the amber fill. White on this amber is 2.6:1 and would fail.
- **Warm neutrals, not grey.** The neutral ramp is warm (`#FAF7F2` to
  `#211E1B`) so a page with one photograph and no imagery does not feel like a
  dashboard. `default-600` carries secondary text at 6.5:1 on paper.
- **Status colours carry information only**, never decoration. A green dot that
  marks nothing does not ship.

### Rules the CSS enforces

`.tth-label` (13px, 500, muted) and `.tth-label-sm` (12px) are the only section
labels. Amber is split by role: `bg-primary` fills, plus one utility,
`.text-primary-accessible`, for every amber word or hairline (amber 800 on
paper, amber 400 on charcoal). Both rules exist because the earlier codebase had
46 hand-rolled uppercase labels and 30 places where amber was used as body
text. HeroUI's own `bordered` button variant is not used either: it paints the
label in raw amber at 1.9:1 on paper, so `ButtonLink` rebuilds that look with
ink text and a neutral hairline.

Both families are registered under literal names in the `@theme` block.
Referencing next/font's `--font-sans` / `--font-fraunces` variables *inside* a
custom property resolved to nothing in Chromium, which quietly left every
headline in Inter.

## Typography

Two faces, split by job:

- **Display: Fraunces** (variable, axes `opsz`/`SOFT`/`WONK`) for page
  headings, article titles, feed cards, the wordmark and pull quotes.
  Reason: the product publishes writing, and a warm serif at 44 to 52px says
  "publication" where a geometric sans says "SaaS landing page".
- **Interface text: Inter**, 13 to 15px for controls, labels and body inside
  cards. Reason: legibility at dense sizes, not novelty. It is also what
  article body copy uses, so the composer still matches the published page.
- **Headline tracking is negative** (`-0.015em`) at display sizes and neutral
  below 20px. Serif capitals need the tighter setting; Inter does not.
- **No uppercase-with-wide-tracking labels.** Section labels are sentence case
  at 13px, weight 500, muted colour (`.tth-label`). Buttons and nav items are
  sentence case too ("Sign up", "Log in", "Send a message").
- **Monospace is for code and for nothing else.**

## Composition

- **One focal point per screen.** On the composer and editor it is the title and
  the writing surface beneath it. The bar, the details panel and the actions all
  defer: smaller type, muted colour, no fill.
- **Whitespace is structure.** The title sits tight under its cover strip; the
  details and actions are separated by a full rule and generous space above.
  Uniform padding everywhere would flatten that, so the spacing scale is used in
  three steps: within a group (8px), between groups (24px), between sections
  (40 to 56px).
- **Rules over boxes.** Separation is drawn with 1px hairlines and space, not
  with nested cards or shadows. A card earns its border only when it is a
  discrete, selectable object in a list.
- **Radius scale:** 6px for controls, 10px for media and panels. Nothing is a
  pill except a tag chip, where the pill shape means "removable token".

## Identity motif

**The left-aligned measure.** Every article screen is one column whose width is
set by readable prose (max 46rem), and every piece of chrome aligns to that same
left edge rather than to the viewport. The title, the body, the details and the
actions start on the same line. It is the motif that makes the composer and the
editor recognisably the same tool, and it is what a reader of the published
article sees too.

**The logo:** an amber square with a T carved into it, square for a code block,
letter for the name. It is the only place a solid amber fill appears at rest, so
the mark and the primary button speak the same language. Full assets and sizes:
`apps/web/public/brand/README.md`.

## The account area (`/profile`)

The member's profile (`/profile/@handle`) and the article list (`/profile/blogs`)
share one shell: the sticky account rail on the left, the content column beside
it. The composer (`/blogs/new`) and the article editor (`/blogs/<slug>/edit`)
sit at the site root beside the published article they are about, and keep the
editor's own full-width frame: a writing page should not be narrowed by the
account rail.

**The profile page is also the editor.** There is no separate settings screen:
"Edit profile" turns the identity block into a form and opens the fields a reader
never sees below it, and one save writes the details, the photo and the social
links. A member edits what they are looking at, so the preview and the result
cannot drift apart.

**Job of the screen:** find the article you want to change and open it, or start
a new one. The decision is "which article", so the articles are the page and
everything else is a tool to narrow them.

- The list is rows, not cards: title first (it is what the writer recognises),
  then category and date, then the numbers that say whether the piece is working.
- The actions that matter (Edit) are visible on every row; destructive ones are
  quieter.
- Empty, filtered-to-nothing and failed-to-load are three different screens with
  three different next actions.

## The newsletter (`/admin/newsletter`, and the signup blocks)

Two tabs, one rail entry: **Issues** and **Subscribers**. They sit together
because the first question about a send is who is on the list and the second is
what went out last month.

- **One focal point:** on the issue builder it is the subject, because it is the
  only line most readers ever read; on the subscriber list it is the address.
  Counts, sources and dates are muted type on the same row.
- **Rules over boxes:** the list is one bordered panel with hairline row
  dividers, not a card per subscriber. The builder is fields and a bordered
  article list on the page itself, not a modal.
- **The article order is the issue.** Picked articles are numbered, in the order
  the reader picked them, because that is the order they appear in the email.
- **Sending is stated, not decorated.** The start button is the danger tone and
  the confirmation says how many inboxes it reaches. A progress bar carries its
  counter beside it; the counter is the source of truth.
- **Empty, failed and filtered-to-nothing** are three different screens, as on
  every other admin list.

The public signup blocks use the site's own type and spacing, and say one plain
line ("We'll email you new articles. Unsubscribe any time.") with the privacy
link beside it. No badge, no invitation illustration, no second button.

## Rules that are not negotiable on these screens

- No fabricated numbers, no invented excerpts, no placeholder people.
- Every control does something or is not shipped.
- Light and dark both work; the site ships a toggle.
- Keyboard reachable, visible focus on everything.
- Mobile is designed, not squeezed: at 360px the bar wraps, the toolbar scrolls,
  and nothing overflows.
