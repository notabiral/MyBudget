# MyBudget — DESIGN.md

The design system for MyBudget, locked 15 November 2026. This file is the
source of truth for how the app looks; `src/App.css` implements it. If the
look and this file ever disagree, this file wins and the CSS gets fixed.

## Direction: "The Ledger"

MyBudget is a cash book, not a dashboard. The app presents itself as a
banker's ledger: warm ruled paper, ink figures in a mono hand, a double
accounting rule above the totals, red ink for money lost. The year grid is
the subject — it is the whole page, set like a page of accounts, with the
month summary as a strip of ledger entries above it.

- Kind: software (a fintech/banking tool). Flat colour, type and rules only;
  no shader effects, scenes, photographs or decorative imagery. The app
  needs none of it, and a budgeting tool should never look like an advert.
- Dials: design variance 5/10 (grid-disciplined, with editorial ledger
  details), motion intensity 2/10 (hover and focus only — this is a working
  tool, not a showcase), visual density 8/10 (the 12-month grid is dense
  by nature; the design embraces that with strict tabular alignment
  instead of fighting it).

## Tokens

All tokens live as CSS custom properties in `src/App.css` (`:root`, with a
`prefers-color-scheme: dark` override — the "night ledger"). Never hard-code
a colour in a component; the one exception is the dynamic Spent % bar width,
which is data, not styling, and stays inline.

| Token | Light (vellum) | Dark (night ledger) | Use |
|---|---|---|---|
| `--paper` | `#f6f1e5` | `#121814` | Page ground |
| `--paper-raised` | `#fffdf6` | `#1a221d` | Table frame, inputs, sticky labels |
| `--paper-deep` | `#ece4cf` | `#1e2822` | Bands, header row, hover |
| `--ink` | `#20241f` | `#e9e4d4` | Text |
| `--ink-soft` | `#5d6357` | `#a9ae9e` | Labels, captions, secondary text |
| `--rule` | `#d8cfb6` | `#33413a` | Hairline rules, dividers |
| `--rule-strong` | `#b3a67f` | `#4c5c51` | Frame, sticky column edge, double rules |
| `--ledger-green` | `#1e4d38` | `#7fb894` | Primary action, focus, spend bars |
| `--ledger-green-deep` | `#143627` | `#9fd0ae` | Primary hover |
| `--red-ink` | `#b3261e` | `#f08a80` | Negative Left, negative Extra, over-100% bars |
| `--green-ink` | `#1e6b41` | `#8fd0a4` | Positive Left and Extra |

No violet or lavender anywhere in the app's own design. Status is carried
by ink colour only: red ink means money lost, green ink means money kept.
Never add a status colour that is not in this table.

## Typography

- Display: **Fraunces** 600 (Google Fonts, `display=swap`), fallback
  Georgia / Times New Roman. The masthead heading only.
- Data and UI: **IBM Plex Mono** 400/500/600 (Google Fonts, `display=swap`),
  fallback `ui-monospace`, Menlo, Consolas. Everything else: labels,
  figures, inputs, buttons. All figures use `font-variant-numeric:
  tabular-nums` so columns align.
- Labels are 11–12px uppercase mono with wide letter-spacing. Headings use
  `text-wrap: balance`.
- Scale: masthead `clamp(32px, 4.5vw, 44px)`; summary values 26px (22px on
  phones); table figures 14px; labels 11–12px; footer 12px.

## Layout

- One column, max width 1560px, equal left/right edges, page padding
  `clamp(16px, 4vw, 48px)`.
- Masthead: wordmark eyebrow ("MyBudget") over the Fraunces heading, with
  the Year / Month / Download CSV controls on the same row; a 4px double
  rule closes the masthead, as a ledger page is ruled off.
- Summary: six entries in a hairline-ruled strip (6 columns desktop,
  3 at ≤1024px, 2 at ≤640px). No cards-within-cards, no shadows.
- Table: framed in `--rule-strong`, `min-width: 1100px`, horizontal scroll
  inside `.table-wrap` on narrow screens (the 13-column grid is never
  squeezed). The first column is sticky so row labels stay visible while
  months scroll. `border-collapse: separate` with `border-spacing: 0` —
  required for the sticky column to keep its borders.
- Radius is sharp (2px) throughout: this is a fintech tool, and square
  corners suit the ledger. The one rounded element is nothing — there is
  none, by design.

## Components

- **Buttons**: one pair only. Primary: ledger-green fill, paper text.
  Secondary: transparent, `--rule-strong` border. Both 44px tall, 13px
  uppercase mono, 2px radius. Hover steps up 1px; active presses back.
- **Inputs**: 44px standalone controls, 40px table cells, `--paper-raised`
  fill, 1px `--rule-strong` border (standalone) or transparent border that
  appears on hover (table cells). Number spinners hidden — the grid is
  typed into, not spun. Focus is always a visible 2px ring.
- **Total rows**: a 3px double top rule above Total (the accounting
  convention for a final figure). Salary, Auto Savings and Accounts rows
  carry the `--paper-deep` band. Extra is unbanded; its ink colour does
  the talking.
- **Spent % bars**: 6px square-ended bars, ledger-green fill, red ink
  past 100%, with the percentage printed beneath. The bar is decorative
  (`aria-hidden`); the printed figure is the information.
- **Delete**: a × button, ink-soft at rest, red ink on hover, with an
  `aria-label` naming the category. No emoji, no icon font.
- **Skip link**: first in the tab order, visible on focus, ledger-green.

## Motion

Hover and focus transitions only (120ms, transform/background/border).
The Spent % bar width animates over 200ms. Under
`prefers-reduced-motion: reduce`, all transitions are removed. No entrances,
no scroll effects, no loops.

## Accessibility notes

- One `h1`, hierarchical headings, `<main>` landmark, skip link.
- Every control is labelled: visible labels for Year/Month, `aria-label`s
  naming category and month on all 156+ grid inputs, `aria-label`s on the
  rename and delete controls.
- Table semantics: `scope="col"` / `scope="row"`, visually-hidden caption.
- Focus is never removed, only designed. Colour is never the only signal
  for the Left/Extra sign: the minus sign in the figure itself carries it.
- Tap targets: standalone controls are 44px. Table cells are 40px and the
  delete button 36×40px — a deliberate density trade-off for a 13-column
  working grid; the grid is a data-entry surface, not a set of marketing
  CTAs.

## Waivers (Taste rules that do not fit this tool)

Recorded so future audits do not re-litigate them:

- **One section per screen / hero alone on the first screen**: waived. The
  app is one dense working surface; the grid is the subject and must be
  visible immediately.
- **Photographs / dealt moments / hero entrance**: waived. A private
  budgeting tool needs no photography, no entrance choreography and no
  award-site moments.
- **Nav/footer deal**: waived. Single-screen app; the footer carries one
  privacy line from the README and nothing else.
- **44px tap targets inside the grid**: waived as noted above (40px cells).

## What is preserved

The revamp is visual only. All state, calculations and behaviour in
`src/App.js` are unchanged: the `localStorage` key (`budget_final`), the
default categories, the salary/savings handling, the Total / Extra /
carried-savings / Spent % maths, the CSV export format and filename, and
every label and figure. If a future change touches any of that, it is a
behaviour change, not a design change, and needs its own review.

## Deployment

GitHub Pages serves the `gh-pages` branch. That branch is a manual
deployment: build locally (`npm run build`) and push the `build/` output
to `gh-pages`. Merging a design change to `main` does not deploy it.
Never commit build output to `main`.
