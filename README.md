# MyBudget

A simple personal budgeting app I built to track my money month by month — salary in, expenses out, and what's left for savings. No accounts, no server: everything runs in the browser and the data never leaves your device.

**Live demo:** https://notabiral.github.io/MyBudget/

## What it does

- **Year-at-a-glance grid** — one table per year, with a column for every month (Jan–Dec).
- **Expense categories** — track spending by category. It starts with my defaults (Loan, Rent, Grocery, Credit Card, Subscriptions, SIM, Apple Music and a couple of personal ones), and you can add, rename or delete categories to make it your own.
- **Salary row** — enter your income per month.
- **Automatic totals** — for each month the app works out:
  - **Total** expenses
  - **Extra** — salary minus expenses (what's left over)
  - **Auto Savings** — leftover money carried forward month to month
  - **Accounts** — savings you enter manually across accounts (mine are ISA, Revolut and Monzo)
  - **Spent %** — expenses as a percentage of that month's income
- **Summary cards** — pick a month to see Income, Expenses, Left, Auto Savings, Accounts and Spent % at a glance.
- **CSV export** — download the whole year (categories, totals, salary, savings) as a `budget_<year>.csv` file.
- **Private by design** — all data is stored in your browser's `localStorage`. Nothing is uploaded anywhere. The trade-off: clearing your browser data, or switching devices/browsers, means starting fresh — export a CSV if you want a backup.

## Tech

- React 19, built with Create React App (react-scripts 5)
- Plain CSS and inline styles, no UI framework
- State persisted to `localStorage`

## Running it locally

```bash
npm install
npm start        # dev server at http://localhost:3000
npm run build    # production build in the build/ folder
npm test         # test runner
```

## Why I built it

Spreadsheets did the job for years, but I wanted something quicker to update on my phone and harder to break with a stray formula. This is the result — deliberately small, one main component, and tailored to how I actually budget.
