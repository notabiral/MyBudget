# MyBudget — DESIGN.md

The design system for MyBudget 2.0, locked 15 November 2026. This file is
the source of truth for how the app looks and behaves; `src/index.css`
implements it. If the look and this file ever disagree, this file wins
and the CSS gets fixed.

## Direction: "The Big Number"

The month's left-to-spend figure is the whole point of opening the app, so
it is treated like a studio hero: one huge grotesque numeral on a
near-black band, spec-sheet labels in mono, the working app in warm white
below. The reference was averlo.co, an AI-native design studio's marketing
site — studied for design language only (one hot accent, huge numerals,
short plain copy, dark/light bands). Nothing was copied: no branding,
logo, name, copy or layouts. The product stays MyBudget.

- Kind: software (a fintech/banking tool). Flat colour, type and rules
  only; no shader effects, scenes, photographs or decorative imagery. A
  budgeting tool should never look like an advert.
- Dials: design variance 6/10 (a bold hero over a disciplined working
  surface), motion intensity 3/10 (hover, focus and one toast entrance —
  a working tool, not a showcase), visual density 7/10 (the dashboard
  is information-dense by nature; strict tabular alignment keeps it
  calm).

## Tokens

All tokens live as CSS custom properties in `src/index.css` (`:root`, with
a `prefers-color-scheme: dark` override). Never hard-code a colour in a
component. The only inline styles allowed are data-driven values: bar
fill (via `scaleX`), chart geometry, and category colours.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--ink` | `#0b0d10` | `#0b0d10` | Hero band, dark surfaces |
| `--ink-raised` | `#16191f` | `#16191f` | Raised dark surfaces |
| `--ink-line` | `rgba(247,245,240,0.16)` | same | Hairlines on dark |
| `--on-dark` | `#f7f5f0` | `#f7f5f0` | Text on dark |
| `--on-dark-2` | `rgba(247,245,240,0.68)` | same | Secondary text on dark |
| `--on-dark-3` | `rgba(247,245,240,0.45)` | same | Faint text on dark |
| `--paper` | `#faf9f6` | `#0b0d10` | Page ground |
| `--surface` | `#ffffff` | `#15181d` | Panels, inputs, dialogs |
| `--surface-2` | `#f1efe9` | `#1d2127` | Wells, tracks, hover |
| `--line` | `#e4e1d8` | `#262b33` | Hairlines, dividers |
| `--line-strong` | `#cfccc0` | `#3a404b` | Input borders |
| `--text` | `#14161a` | `#f2f0ea` | Text |
| `--text-2` | `#5b6068` | `#a7adb6` | Secondary text |
| `--text-3` | `#8a8f98` | `#7d838d` | Placeholders, faint labels |
| `--accent` | `#ff5c00` | `#ff5c00` | The one hot accent: primary actions, focus, hero details |
| `--accent-deep` | `#d64d00` | `#d64d00` | Accent hover, link hover |
| `--accent-soft` | `#fff0e6` | `#2a1a0e` | Accent tint |
| `--accent-ink` | `#0b0d10` | `#0b0d10` | Text on accent fills |
| `--good` | `#0f7a4d` | `#4cc38a` | Money in, on-track |
| `--good-soft` | `#e5f4ec` | `#0f2a1d` | Good tint |
| `--good-on-dark` | `#7ed9a8` | `#7ed9a8` | Good on the hero band |
| `--bad` | `#c92a1f` | `#f97066` | Over budget, destructive |
| `--bad-soft` | `#fdecea` | `#331412` | Bad tint |
| `--bad-on-dark` | `#ff9a86` | `#ff9a86` | Bad on the hero band |
| `--warn` | `#9a4a08` | `#fdb022` | Warnings |
| `--warn-soft` | `#fef3e5` | `#2c1e08` | Warning tint |

Category palette (8, assigned in order, no violet): `--cat-1` teal
`#0e9384`, `--cat-2` blue `#175cd3`, `--cat-3` pink `#c11574`, `--cat-4`
green `#067647`, `--cat-5` amber `#b54708`, `--cat-6` orange `#ec4a0a`,
`--cat-7` slate `#475467`, `--cat-8` red `#b42318`.

No violet or lavender anywhere in the app's own design. Status is never
carried by colour alone: signs, words ("over", "left", "paused") and the
figures themselves do the talking.

Radii: `--radius` 14px, `--radius-lg` 20px, `--radius-pill` 999px.
Shadows: `--shadow-1` (resting panels), `--shadow-2` (dialogs, toasts).

## Typography

- Display: **Space Grotesk** 500/600/700 (Google Fonts, `display=swap`),
  fallback Inter / system sans. Hero figure, view titles, section titles,
  money figures.
- UI: **Inter** 400/500/600/700 (Google Fonts, `display=swap`), fallback
  system sans. Everything else.
- Labels: **IBM Plex Mono** 400/500/600 (Google Fonts, `display=swap`),
  fallback ui-monospace / Menlo / Consolas. Eyebrows, spec-sheet labels,
  chart annotations.
- All figures use `font-variant-numeric: tabular-nums` so columns align.
- Headings use `text-wrap: balance`. Eyebrow labels are 11px uppercase
  mono with wide letter-spacing.
- Scale: hero figure `clamp(56px, 9vw, 96px)`; view titles
  `clamp(28px, 4vw, 36px)`; section titles 21px; body 16px; small 14px;
  captions 13px.

## Layout

- One column, max width 1200px, page padding
  `clamp(16px, 4vw, 32px)` widened by `env(safe-area-inset-*)` on notched
  devices.
- Header: wordmark left, period toggle (Week / Month) plus period
  navigator centre-right, Add entry right. Below it, sticky view tabs
  (Overview / Entries / Budgets / Savings / Your data) with a blur
  backdrop.
- Overview: full-bleed hero band (the Big Number, verdict line, five
  facts, period-elapsed bar), then a 12-column dashboard grid (7/5 splits).
- Breakpoints: ≤900px (dashboard stacks, budget rows reflow), ≤640px
  (dialog actions stretch, transaction rows stack). No horizontal
  overflow at 390px; `overflow-x: clip` on the body is a guard, not a
  fix — content must fit by construction.
- Zoom is never disabled: the viewport meta is
  `width=device-width, initial-scale=1` with no `maximum-scale`.

## Components

- **Buttons**: primary (accent fill, ink text), secondary (surface,
  strong border), dark, outline, danger, ghost, small. 48px inputs,
  44px+ tap targets, 120ms hover/active transitions. Every button has a
  visible hover state.
- **Hero**: near-black band, mono eyebrow (the period + "Left to spend"),
  the Big Number in Space Grotesk 700, a one-line verdict in plain
  language, five facts in a definition list (Money in / Money out /
  Saved / Brought forward / Spent), and a period-elapsed bar in the current period.
  A negative figure shows a real minus sign, never colour alone.
  The Big Number is left-to-spend: money brought forward (the running
  balance through the day before the period starts) + the period's income
  − spending − savings set aside. It is identical to the running balance
  through the period end. The period-only income-minus-expenses figure
  ("Extra") is kept for the legacy year-grid CSV only, never shown as the hero.
- **Periods**: the header toggle switches the whole app between Month and
  Week views; the choice persists in settings (`prefs.periodMode`) and
  Month is the default, so monthly-paid users see no change. Weeks are
  Monday–Sunday calendar weeks numbered per ISO 8601 ("2026-W46"), with
  week 1 the week containing the first Thursday — a week key's year can
  differ from the calendar year of its dates. Switching modes keeps the
  user's place: the newly selected period is the one containing the day
  the previous period pointed at. Month summaries already aggregate all
  dated entries, so the monthly overview works unchanged for weekly-paid
  users; the trend chart shows the last 6 months in month mode and the
  last 8 weeks in week mode.
- **Bars**: 8px tracks in `--surface-2`, fill via `transform: scaleX()`
  (compositor-friendly, never a width animation), red past 100%. Every
  bar has an accessible name with the real figures; the bar is never the
  only signal.
- **Trend chart**: hand-rolled SVG, paired bars per period (money in /
  money out), with a visually-hidden data table carrying the same
  figures. Axis labels sit in a left gutter, right-aligned clear of the
  plot, on a nice-number scale (1/2/2.5/5 × 10^k, floored at £1) so no
  label ever hides behind a bar or repeats on a quiet window. No chart library.
- **Quick add**: the row pinned at the top of the Entries view — type
  (money out / money in / savings, segmented radios), amount, date,
  category or savings account, note, and an Add button. Enter saves and
  clears amount and note for the next entry, keeping the type, category
  and date, and moves focus back to the amount for rapid entry. The
  category picker defaults to the last-used category of that kind (from
  any entry, including dialog-added ones). The date defaults to today
  when viewing the current period, else the period's first day, and
  follows period navigation. Savings entries here are deposits only;
  withdrawals, repeating entries and full edits stay in the dialog.
  The row is labelled one-off only, and "Make it repeating" opens the
  dialog with repeating pre-ticked and the typed draft carried over.
  Existing rows edit their amount inline, following the Budgets
  blur-commit pattern exactly: tap the amount, edit, blur or Enter
  commits, Escape cancels, an invalid draft reverts visibly to the saved
  value. Edit/delete icon buttons and the delete undo-toast are unchanged.
- **Budgets**: one row per spending category with a budget input
  that commits on blur. Weekly and monthly budgets are separate amounts
  (`weeklyBudgetMinor`, `monthlyBudgetMinor`): week mode edits weekly
  amounts, month mode edits monthly amounts. **Collapse rule**: in month
  mode, a category with an explicit monthly amount uses it; a category
  with only a weekly amount shows a derived monthly figure — weekly ×
  days in month / 7, rounded to the nearest penny — labelled as derived
  from the weekly amount, with the input left for the explicit monthly
  amount. A derived figure never overwrites an explicit one. When no
  category has a budget yet, a tinted hint strip explains that budgets
  repeat and offers a button that moves focus to the first budget input.
  Budgets are never invented or auto-assigned; the header shows "No
  budgets set yet" instead of a £0-of-£0 line until the first budget exists.
- **Panels**: white surfaces, 1px `--line` border, 20px radius, no
  cards-within-cards.
- **Dialogs**: native `<dialog>` (Escape closes, browser top-layer focus
  trap), 520px max, scrollable with `overscroll-behavior: contain`.
  Forms use visible labels, inline errors with `aria-invalid` /
  `aria-describedby`, and focus moves to the first failed field on
  submit.
- **Toasts**: dark, bottom-anchored, `aria-live="polite"`, 10s expiry.
  Every destructive action (delete entry/category/account/rule, import,
  demo load/delete) offers Undo from the toast instead of a confirmation
  modal. Erase-everything is the one exception: it needs an explicit
  confirmation dialog because there is nothing left to undo from.
- **Notices**: slim strips above the views — the one-time migration
  notice, the corrupt-data recovery notice, and the persistent demo-data
  banner (with one-tap delete) while demo data is on.
- **Empty states**: every view handles the zero case with a short
  explanation and the next action. No broken UI for empty data, ever.
- **Onboarding**: full-screen dark welcome for a fresh install — Start
  fresh, Explore with demo data (explicit opt-in, clearly labelled), or
  import from the Data view. Demo data is never presented as real.
- **Focus**: always a visible 2px accent ring via `:focus-visible`.
  Never removed, only designed. `scroll-padding-top` keeps focused
  content clear of the sticky tabs.

## Motion

Transform/opacity only (bar fills via `scaleX`, toast entrance via
translate+fade, hover lifts via `translateY`). No `transition: all` —
every transition lists its properties. Under
`prefers-reduced-motion: reduce`, all animation and transition durations
collapse to 0.01ms. No entrances, no scroll effects, no loops.

## Accessibility notes

- One `h1` per view (the hero eyebrow on Overview), hierarchical
  headings, `<main>` landmark, skip link first in the tab order.
- Every control is labelled: visible `<label>`s, `aria-label`s on
  icon-only buttons (with matching `title` tooltips), `aria-current` on
  the active view tab, `aria-expanded` on the archived-categories toggle.
- Native semantics before ARIA: `<button>` for actions, `<fieldset>` +
  `<legend>` for the entry-type and direction groups, `<dl>` for hero
  facts, `<table>` for chart data, `<ul>` for lists.
- Colour is never the only signal. The minus sign, the words "over" /
  "left" / "paused", and the figures themselves carry meaning.
- Tap targets are 44px+ except the 32px icon buttons, which sit in dense
  working rows next to large text targets — a deliberate density
  trade-off, matching the old grid's approach.
- Charts, bars and the trend visual all expose their data as text
  (accessible names, hidden tables).
- Reduced motion is honoured throughout; the toast entrance and bar
  fills collapse to instant under the media query.

## Data

- Storage key: `mybudget.v1` in `localStorage`. Money is integer minor
  units (pence) everywhere in state; floats only at the parse/format
  boundary. See `src/lib/model.js` for the schema. Categories carry both
  `monthlyBudgetMinor` and `weeklyBudgetMinor` (either may be null);
  saved states from before weekly budgets normalise the missing field to
  null with no migration. The period-mode preference lives in
  `prefs.periodMode` ("month" default) and persists like the currency
  setting.
- **Migration**: on first load, if no v1 state exists and the legacy
  `budget_final` key holds data, each nonzero legacy figure becomes one
  dated entry (1st of the month, noted "Imported from the previous
  MyBudget"). The legacy key is never written — it stays in the browser
  as a backup. Zero/negative/non-numeric figures are skipped and counted
  in the migration report shown once after import.
- **Household-ready**: every entry and rule carries a `memberId`, and
  state holds a `members` list. The UI ships with one member ("Me") and
  no fake multi-user features; the structure is there for later.
- **Demo data**: generated, round, generic figures for three months,
  every item flagged `demo: true`, loaded only by explicit opt-in, and
  deletable in one tap without touching real data.
- **CSV**: the year-grid export keeps the original app's shape (header,
  category rows, Total, income rows, Extra, Auto Savings, Manual
  Savings) and filename (`budget_<year>.csv`); the one change is that
  all values are now consistently 2dp (the old export mixed raw numbers
  and `toFixed(2)` computed rows). A ledger export
  (`mybudget_transactions_<year>.csv`) lists every entry. Both formats
  import back, with exact-duplicate detection.
- **Privacy**: no backend, no accounts, no tracking, no network calls
  except the Google Fonts stylesheet. Nothing is uploaded anywhere.
  Clearing the browser's site data wipes MyBudget — the Data view says
  so, and offers a full JSON backup.

## Waivers

Recorded so future audits do not re-litigate them. Two sets: Taste
marketing-page rules that do not fit a private tool, and Vercel Web
Interface Guidelines items deliberately not followed (audited 15 Nov
2026 against freshly fetched rules).

Taste waivers:

- **One section per screen / hero alone on the first screen**: waived.
  The dashboard is a working surface; the hero leads but the panels
  below are the job.
- **Photographs / dealt moments / hero entrance**: waived. A private
  budgeting tool needs no photography, no entrance choreography and no
  award-site moments.
- **Nav/footer deal**: waived. The footer carries one privacy line and
  nothing else.
- **Invented social proof**: never. No reviews, no figures, no
  testimonials anywhere in the app.

Vercel guideline waivers:

- **URL reflects state (filters/tabs in query params)**: waived. The app
  has no router; view, month and filters are ephemeral session state in
  a local-only tool with no sharing. Tabs are `<button>`s, not links,
  for the same reason — there are no routes to link to.
- **Title Case headings/buttons**: waived. Sentence case is the
  deliberate product voice ("Add entry", "Delete demo data"), applied
  consistently throughout, matching modern fintech convention.
- **Font preload**: waived. Fonts load via the Google Fonts stylesheet
  with `display=swap` plus `preconnect`; direct preload would need
  brittle hardcoded hashed font URLs.
- **Warn before navigation with unsaved changes**: waived. Committed
  data persists instantly on every change; dialogs hold only
  unsubmitted drafts, and closing one discards the draft — standard
  modal behaviour.
- **Placeholders end with …**: partially waived. Example-pattern
  placeholders do (`e.g. Pet care…`); numeric patterns (`0.00`) and the
  state label (`No budget`) do not, because an ellipsis would read as
  part of the value.
- **Budget blur-commit errors**: waived. An invalid budget draft reverts
  visibly to the last saved value on blur; no error state is needed for
  a reverted draft. The same rule covers inline amount edits on entry
  rows.
- **Page rubber-band suppression**: waived. Pull-to-refresh is preserved;
  the guideline itself flags the hybrid-device risk of disabling it.
- **List virtualization**: implemented as `content-visibility: auto` on
  date groups instead of a virtualization library — the list is
  date-grouped and small per group, and no heavy dependency is
  justified.
- **autoFocus**: justified, not waived. One primary target per surface:
  the dialog's first field (via `data-autofocus`), the rename input
  after an explicit Rename click, the onboarding primary button, and
  the inline amount input after an explicit tap on an amount. The
  quick-add amount input is refocused after each save so rapid entry
  keeps working — a focus move after an explicit user action, announced
  by the success line.
- **Money inputs use text + `inputmode="decimal"`** instead of
  `type="number"`: deliberate — avoids spinner and locale quirks; the
  standard money-input pattern.

## Deployment

GitHub Pages serves the `gh-pages` branch. That branch is a manual
deployment: build locally (`npm run build`) and push the `dist/` output
to `gh-pages`, with `base: "/MyBudget/"` in `vite.config.js`. Merging to
`main` does not deploy. Never commit build output to `main`. The live
site must keep serving at `https://notabiral.github.io/MyBudget/`.

## Stack

Vite 6 + React 19 + Vitest. No router, no chart library, no UI
framework — hand-rolled SVG charts, native `<dialog>` modals, one
hand-written stylesheet. Tests cover the core maths, week/month
periods, the weekly-budget collapse rule, migration, recurring rules
and CSV handling (`src/lib/*.test.js`, 122 tests).
