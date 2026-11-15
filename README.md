# MyBudget

A local-first budgeting platform: plan the month, track every pound, save
with intent. No accounts, no server, no tracking — everything runs in the
browser and the data never leaves your device.

**Live site:** https://notabiral.github.io/MyBudget/

## What it does

- **Overview** — the month's left-to-spend figure up front (money brought
  forward plus this month's income, minus spending and savings set aside),
  with money in, money out, saved, brought forward and spent %, a
  plain-language verdict, spending by category, a six-month trend chart,
  recent activity and a savings snapshot.
- **Entries** — income, expenses and savings transfers, with search, type
  and category filters, month/all-months views, and repeating entries
  (weekly or monthly rules that generate future entries automatically).
- **Budgets** — a monthly budget per spending category, with spent/left
  indicators and over-budget flags. Rename, archive and delete categories;
  income categories live here too.
- **Savings** — savings accounts with optional targets and progress bars.
  Put money in, take money out, watch the bar fill.
- **Your data** — full JSON backup export/import, CSV export/import (the
  year grid keeps the original `budget_<year>.csv` shape), demo data
  opt-in and one-tap delete, currency display (GBP/USD/EUR), and a
  start-over danger zone.
- **Undo everywhere** — deletes, imports and demo-data changes all offer
  Undo from a toast instead of a confirmation modal.
- **Private by design** — all data is stored in your browser's
  `localStorage` under the key `mybudget.v1`. Nothing is uploaded
  anywhere. The trade-off: clearing your browser's site data wipes
  MyBudget — download a backup from the Data view if anything here
  matters.

## Migrating from the old app

If your browser holds data from the original MyBudget (localStorage key
`budget_final`), the new app moves it over automatically on first load:
every nonzero figure becomes one dated entry, categories and savings
accounts are carried across, and a notice reports what moved. The old
`budget_final` key is left untouched as a backup — the migration never
writes to it. Zero, negative and non-numeric figures are skipped and
counted in the report.

## CSV formats

- **Year grid** (`budget_<year>.csv`) — the original app's shape:
  categories down the side, months across the top, then Total, income
  rows, Extra, Auto Savings and Manual Savings. One change from the old
  export: all values are now consistently 2 decimal places (the old
  export mixed raw numbers with 2dp computed rows).
- **Ledger** (`mybudget_transactions_<year>.csv`) — every entry, one per
  row: date, type, category, account, note, amount (savings withdrawals
  are negative).

Both formats import back from the Data view. Grid files carry no year, so
you pick the year on import. Exact duplicates are skipped.

## Tech

- Vite 6 + React 19, plain CSS in `src/index.css` (no UI framework, no
  chart library, no router). The design system is locked in `DESIGN.md`.
- Space Grotesk, Inter and IBM Plex Mono via Google Fonts, with system
  fallbacks.
- Money is integer minor units (pence) everywhere in state; floats only
  at the parse/format boundary.
- Tests: Vitest, covering the core maths, migration, recurring rules and
  CSV handling (`src/lib/*.test.js`).

## Running it locally

```bash
npm install
npm run dev      # dev server at http://localhost:5173
npm run build    # production build in the dist/ folder
npm test         # test suite (44 tests)
```

## Deploying

GitHub Pages serves the `gh-pages` branch via manual deploy — merging to
`main` does not deploy. To deploy:

```bash
npm run build
# push the dist/ output to the gh-pages branch (base path /MyBudget/,
# set in vite.config.js), keeping the live site at
# https://notabiral.github.io/MyBudget/
```

Never commit build output to `main`.

## Why I built it

Spreadsheets did the job for years, but I wanted something quicker to
update on my phone and harder to break with a stray formula. This is the
result — a proper budgeting platform, still deliberately private: your
money, in plain sight, and nowhere else.
