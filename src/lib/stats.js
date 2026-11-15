// Pure calculations over v1 state. Every figure the UI shows comes from
// here, and every function is covered by tests in stats.test.js.
//
// Definitions (kept compatible with the original app's meanings):
// - income:    sum of income transactions in the month
// - expenses:  sum of expense transactions in the month
// - savings:   net sum of saving transactions in the month (deposits minus
//              withdrawals; saving transactions may be negative)
// - left:      income minus expenses ("Extra" in the old app)
// - spend %:   expenses as a share of income; 0 when there is no income
// - carried:   running balance — cumulative income minus expenses minus
//              savings, from the first recorded month through this one.
//              The old app's "Auto Savings" row was the same idea scoped to
//              one year and before savings; see yearExtraSeries() for the
//              exact legacy-compatible series used by the grid CSV export.

import { MONTH_ABBR, monthKeyOf, shiftMonth } from "./dates.js";

export function transactionsInMonth(state, key) {
  return state.transactions.filter((t) => monthKeyOf(t.date) === key);
}

export function sumKind(transactions, kind) {
  let total = 0;
  for (const t of transactions) {
    if (t.kind === kind) total += t.amountMinor;
  }
  return total;
}

export function monthSummary(state, key) {
  const txns = transactionsInMonth(state, key);
  const income = sumKind(txns, "income");
  const expenses = sumKind(txns, "expense");
  const savings = sumKind(txns, "saving");
  const left = income - expenses;
  const spendRatio = income > 0 ? expenses / income : 0;
  return {
    key,
    income,
    expenses,
    savings,
    left,
    spendRatio,
    carried: runningBalance(state, key),
    count: txns.length,
  };
}

/** Cumulative income − expenses − savings for all months up to and including `key`. */
export function runningBalance(state, throughKey) {
  let balance = 0;
  for (const t of state.transactions) {
    if (monthKeyOf(t.date) > throughKey) continue;
    if (t.kind === "income") balance += t.amountMinor;
    else if (t.kind === "expense") balance -= t.amountMinor;
    else if (t.kind === "saving") balance -= t.amountMinor;
  }
  // Opening balances of savings accounts count as money already set aside
  // before the first transaction, so they reduce the carried balance.
  for (const a of state.accounts) {
    balance -= a.openingMinor || 0;
  }
  return balance;
}

/**
 * Per-month expense totals by category for one month, with budget and
 * remaining figures. Archived categories appear only when they have spend
 * in the month, so history never vanishes from the breakdown.
 */
export function categorySpend(state, key) {
  const spentById = new Map();
  for (const t of transactionsInMonth(state, key)) {
    if (t.kind !== "expense") continue;
    spentById.set(t.categoryId, (spentById.get(t.categoryId) || 0) + t.amountMinor);
  }
  const rows = [];
  for (const category of state.categories) {
    if (category.kind !== "expense") continue;
    const spent = spentById.get(category.id) || 0;
    if (category.archived && spent === 0) continue;
    const budget = category.monthlyBudgetMinor;
    rows.push({
      category,
      spent,
      budget,
      remaining: budget === null ? null : budget - spent,
      ratio: budget && budget > 0 ? spent / budget : 0,
      over: budget !== null && spent > budget,
    });
  }
  // Uncategorized spend (category deleted after the fact) gets its own row.
  const uncategorized = spentById.get(null) || 0;
  if (uncategorized > 0) {
    rows.push({
      category: null,
      spent: uncategorized,
      budget: null,
      remaining: null,
      ratio: 0,
      over: false,
    });
  }
  rows.sort((a, b) => b.spent - a.spent);
  return rows;
}

/** Last `count` months ending at `endKey`, oldest first. */
export function trend(state, endKey, count = 6) {
  const keys = [];
  for (let i = count - 1; i >= 0; i--) keys.push(shiftMonth(endKey, -i));
  return keys.map((key) => {
    const s = monthSummary(state, key);
    return { key, income: s.income, expenses: s.expenses, savings: s.savings, left: s.left };
  });
}

export function accountBalance(state, accountId) {
  const account = state.accounts.find((a) => a.id === accountId);
  if (!account) return 0;
  let balance = account.openingMinor || 0;
  for (const t of state.transactions) {
    if (t.kind === "saving" && t.accountId === accountId) balance += t.amountMinor;
  }
  return balance;
}

export function totalSaved(state) {
  return state.accounts.reduce((sum, a) => sum + accountBalance(state, a.id), 0);
}

/**
 * The legacy-compatible year series used by the grid CSV export: for each
 * month, income ("Salary"), expenses ("Total"), extra ("Extra"), the
 * within-year cumulative extra ("Auto Savings") and net savings
 * ("Manual Savings"). Category rows come from monthlyCategoryTotals().
 */
export function yearSeries(state, year) {
  const months = [];
  let cumulativeExtra = 0;
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    const s = monthSummary(state, key);
    cumulativeExtra += s.left;
    months.push({
      key,
      abbr: MONTH_ABBR[m - 1],
      income: s.income,
      expenses: s.expenses,
      extra: s.left,
      carriedExtra: cumulativeExtra,
      savings: s.savings,
    });
  }
  return months;
}

/** Monthly expense totals per category for a year: Map(categoryId -> [12 totals]). */
export function monthlyCategoryTotals(state, year) {
  const totals = new Map();
  for (const category of state.categories) {
    if (category.kind === "expense") totals.set(category.id, new Array(12).fill(0));
  }
  for (const t of state.transactions) {
    if (t.kind !== "expense") continue;
    if (!t.date.startsWith(`${year}-`)) continue;
    const monthIndex = Number(t.date.slice(5, 7)) - 1;
    const row = totals.get(t.categoryId);
    if (row) row[monthIndex] += t.amountMinor;
  }
  return totals;
}

export function yearRange(state, fallbackYear) {
  let min = null;
  let max = null;
  for (const t of state.transactions) {
    const y = Number(t.date.slice(0, 4));
    if (min === null || y < min) min = y;
    if (max === null || y > max) max = y;
  }
  if (min === null) return [fallbackYear, fallbackYear];
  return [min, Math.max(max, fallbackYear)];
}

export function filterTransactions(
  state,
  { query = "", kind = "all", categoryId = "all", monthKey = null } = {}
) {
  const q = query.trim().toLowerCase();
  const categoryById = new Map(state.categories.map((c) => [c.id, c]));
  const accountById = new Map(state.accounts.map((a) => [a.id, a]));
  const out = state.transactions.filter((t) => {
    if (monthKey && monthKeyOf(t.date) !== monthKey) return false;
    if (kind !== "all" && t.kind !== kind) return false;
    if (categoryId !== "all" && t.categoryId !== categoryId) return false;
    if (q) {
      const haystacks = [
        t.note,
        categoryById.get(t.categoryId)?.name || "",
        accountById.get(t.accountId)?.name || "",
        t.date,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystacks.includes(q)) return false;
    }
    return true;
  });
  out.sort((a, b) =>
    a.date !== b.date
      ? b.date.localeCompare(a.date)
      : (b.createdAt || "").localeCompare(a.createdAt || "")
  );
  return out;
}
