// Migration from the original MyBudget storage shape (localStorage key
// "budget_final") to the v1 model. This runs once, on first load, only when
// no v1 state exists yet. The legacy key is NEVER written to or deleted —
// it stays in place as a backup.
//
// Legacy shape (one entry per year):
//   {
//     "2026": {
//       expenses: { "Rent": { "Jan": 1025, ... }, ... },
//       salary:   { "Jan": 3600, ... },
//       savings:  { "ISA": { "Jan": 200, ... }, ... },
//       categories: ["Loan", "Rent", ...]
//     }
//   }
//
// Each nonzero monthly figure becomes one transaction dated the 1st of that
// month, so monthly totals in the new app match the old grid exactly.

import { MONTH_ABBR, toISO } from "./dates.js";
import { poundsToMinor } from "./money.js";
import { blankAccount, blankCategory, blankState } from "./model.js";
import { newId } from "./ids.js";

const MIGRATION_NOTE = "Imported from the previous MyBudget";

function legacyNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/**
 * Migrate parsed legacy data to a v1 state.
 * Returns { state, report }. The report counts everything so the UI can
 * tell the user exactly what moved over — and what did not.
 */
export function migrateLegacy(legacy, { now = new Date().toISOString() } = {}) {
  const state = blankState();
  const report = {
    hadData: false,
    years: 0,
    transactions: 0,
    categories: 0,
    accounts: 0,
    skipped: 0, // zero, negative or non-numeric figures left behind
  };

  if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) {
    return { state, report };
  }

  const years = Object.keys(legacy)
    .filter((y) => /^\d{4}$/.test(y) && legacy[y] && typeof legacy[y] === "object")
    .sort();
  if (years.length === 0) return { state, report };
  report.hadData = true;
  report.years = years.length;

  // Categories: union of every year's category list, then any expense key
  // that never appeared in a list, in first-seen order.
  const expenseNames = [];
  const seenNames = new Set();
  const pushName = (name) => {
    if (typeof name === "string" && name.trim() !== "" && !seenNames.has(name)) {
      seenNames.add(name);
      expenseNames.push(name);
    }
  };
  for (const year of years) {
    const list = legacy[year].categories;
    if (Array.isArray(list)) list.forEach(pushName);
  }
  for (const year of years) {
    const expenses = legacy[year].expenses;
    if (expenses && typeof expenses === "object") {
      Object.keys(expenses).forEach(pushName);
    }
  }

  const categories = expenseNames.map((name, i) => blankCategory(name, "expense", i));
  const salaryCategory = blankCategory("Salary", "income", expenseNames.length);
  const categoryByName = new Map(categories.map((c) => [c.name, c]));
  state.categories = [...categories, salaryCategory];

  // Savings accounts: union of every year's savings keys.
  const accountNames = [];
  const seenAccounts = new Set();
  for (const year of years) {
    const savings = legacy[year].savings;
    if (savings && typeof savings === "object") {
      for (const name of Object.keys(savings)) {
        if (typeof name === "string" && name.trim() !== "" && !seenAccounts.has(name)) {
          seenAccounts.add(name);
          accountNames.push(name);
        }
      }
    }
  }
  state.accounts = accountNames.map((name, i) => blankAccount(name, i));
  const accountByName = new Map(state.accounts.map((a) => [a.name, a]));

  report.categories = state.categories.length;
  report.accounts = state.accounts.length;

  const memberId = state.members[0].id;
  const transactions = [];
  const addTxn = (date, kind, amountMinor, extra) => {
    transactions.push({
      id: newId("txn"),
      date,
      kind,
      amountMinor,
      categoryId: null,
      accountId: null,
      memberId,
      note: MIGRATION_NOTE,
      ruleId: null,
      periodKey: null,
      createdAt: now,
      updatedAt: now,
      ...extra,
    });
  };

  for (const year of years) {
    const yearData = legacy[year];
    const yearNum = Number(year);
    for (let m = 0; m < 12; m++) {
      const monthAbbr = MONTH_ABBR[m];
      const date = toISO(yearNum, m + 1, 1);

      const salaryRaw = yearData.salary?.[monthAbbr];
      if (salaryRaw !== undefined && salaryRaw !== null && salaryRaw !== "") {
        const salary = legacyNumber(salaryRaw);
        if (salary !== null && salary > 0) {
          addTxn(date, "income", poundsToMinor(salary), {
            categoryId: salaryCategory.id,
          });
        } else {
          report.skipped += 1;
        }
      }

      const expenses = yearData.expenses;
      if (expenses && typeof expenses === "object") {
        for (const [name, byMonth] of Object.entries(expenses)) {
          const raw = byMonth?.[monthAbbr];
          if (raw === undefined || raw === null || raw === "") continue;
          const value = legacyNumber(raw);
          if (value !== null && value > 0) {
            addTxn(date, "expense", poundsToMinor(value), {
              categoryId: categoryByName.get(name)?.id ?? null,
            });
          } else {
            report.skipped += 1;
          }
        }
      }

      const savings = yearData.savings;
      if (savings && typeof savings === "object") {
        for (const [name, byMonth] of Object.entries(savings)) {
          const raw = byMonth?.[monthAbbr];
          if (raw === undefined || raw === null || raw === "") continue;
          const value = legacyNumber(raw);
          if (value !== null && value > 0) {
            addTxn(date, "saving", poundsToMinor(value), {
              accountId: accountByName.get(name)?.id ?? null,
            });
          } else {
            report.skipped += 1;
          }
        }
      }
    }
  }

  transactions.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  state.transactions = transactions;
  report.transactions = transactions.length;

  state.meta.migratedFrom = "budget_final";
  state.meta.migratedAt = now;
  return { state, report };
}
