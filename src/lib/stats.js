// Pure calculations over v1 state. Every figure the UI shows comes from
// here, and every function is covered by tests in stats.test.js.
//
// Definitions (kept compatible with the original app's meanings):
// - income:    sum of income transactions in the period
// - expenses:  sum of expense transactions in the period
// - savings:   net sum of saving transactions in the period (deposits minus
//              withdrawals; saving transactions may be negative)
// - left:      income minus expenses ("Extra" in the old app). Period-only,
//              ignoring anything brought forward; kept for the
//              legacy-compatible year grid and CSV export.
// - opening:   money brought forward into the period: the running balance
//              through the day before the period starts (cumulative income
//              minus expenses minus savings, net of savings-account opening
//              balances).
// - leftToSpend: opening + income - expenses - savings. The spendable
//              figure for the period, shown as the hero number. Identical
//              to the running balance through the period end ("carried") by
//              construction; the identity is asserted in the tests.
// - spend %:   expenses as a share of income; 0 when there is no income
// - carried:   running balance — cumulative income minus expenses minus
//              savings, from the first recorded transaction through the
//              period end. The old app's "Auto Savings" row was the same
//              idea scoped to one year and before savings; see
//              yearExtraSeries() for the exact legacy-compatible series
//              used by the grid CSV export.
// Periods are months ("2026-11") or Monday-start ISO weeks ("2026-W46");
// monthSummary and weekSummary share periodSummary, so the figures mean
// the same thing in either mode.

import {
  MONTH_ABBR,
  addDays,
  daysInMonth,
  monthKeyOf,
  monthKeyParts,
  shiftMonth,
  shiftWeek,
  toISO,
  weekKeyOf,
  weekRange,
} from "./dates.js";

export function transactionsInMonth(state, key) {
  return state.transactions.filter((t) => monthKeyOf(t.date) === key);
}

export function transactionsInWeek(state, key) {
  return state.transactions.filter((t) => weekKeyOf(t.date) === key);
}

export function sumKind(transactions, kind) {
  let total = 0;
  for (const t of transactions) {
    if (t.kind === kind) total += t.amountMinor;
  }
  return total;
}

/**
 * Summary over any inclusive date range. `opening` is the running balance
 * through the day before the range starts; `leftToSpend` is opening +
 * income − expenses − savings, identical to the running balance through
 * the range end. Month and week summaries are both built on this, so the
 * hero figure means the same thing in either period mode.
 */
export function periodSummary(state, startISO, endISO) {
  const txns = state.transactions.filter((t) => t.date >= startISO && t.date <= endISO);
  const income = sumKind(txns, "income");
  const expenses = sumKind(txns, "expense");
  const savings = sumKind(txns, "saving");
  const left = income - expenses;
  const opening = runningBalanceThroughDate(state, addDays(startISO, -1));
  const leftToSpend = opening + income - expenses - savings;
  const spendRatio = income > 0 ? expenses / income : 0;
  return {
    income,
    expenses,
    savings,
    left,
    opening,
    leftToSpend,
    spendRatio,
    carried: runningBalanceThroughDate(state, endISO),
    count: txns.length,
  };
}

export function monthSummary(state, key) {
  const parts = monthKeyParts(key);
  if (!parts) {
    return {
      key,
      income: 0,
      expenses: 0,
      savings: 0,
      left: 0,
      opening: 0,
      leftToSpend: 0,
      spendRatio: 0,
      carried: 0,
      count: 0,
    };
  }
  const start = toISO(parts.year, parts.month, 1);
  const end = toISO(parts.year, parts.month, daysInMonth(parts.year, parts.month));
  return { key, ...periodSummary(state, start, end) };
}

export function weekSummary(state, key) {
  const range = weekRange(key);
  if (!range) {
    return {
      key,
      income: 0,
      expenses: 0,
      savings: 0,
      left: 0,
      opening: 0,
      leftToSpend: 0,
      spendRatio: 0,
      carried: 0,
      count: 0,
    };
  }
  return { key, ...periodSummary(state, range.start, range.end) };
}

/** Cumulative income − expenses − savings for all dates up to and including `throughISO`. */
export function runningBalanceThroughDate(state, throughISO) {
  let balance = 0;
  for (const t of state.transactions) {
    if (t.date > throughISO) continue;
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
 * The effective monthly budget for a category in a month: the explicit
 * monthly amount when set, otherwise the weekly amount collapsed into the
 * month (weekly × days in month / 7, rounded to the nearest penny).
 * An explicit monthly amount is never overwritten by a derived one.
 * Returns { budget, derived } with budget null when neither is set.
 */
export function monthlyBudgetFor(category, monthKey) {
  if (category.monthlyBudgetMinor !== null && category.monthlyBudgetMinor !== undefined) {
    return { budget: category.monthlyBudgetMinor, derived: false };
  }
  if (category.weeklyBudgetMinor === null || category.weeklyBudgetMinor === undefined) {
    return { budget: null, derived: false };
  }
  const parts = monthKeyParts(monthKey);
  if (!parts) return { budget: null, derived: false };
  const days = daysInMonth(parts.year, parts.month);
  return {
    budget: Math.round((category.weeklyBudgetMinor * days) / 7),
    derived: true,
  };
}

/**
 * Per-period expense totals by category, with budget and remaining
 * figures. Archived categories appear only when they have spend in the
 * period, so history never vanishes from the breakdown.
 *
 * `mode` is "month" (default) or "week". In week mode the budget is the
 * category's weekly amount; in month mode it is the effective monthly
 * budget (explicit monthly, else derived from the weekly amount — see
 * monthlyBudgetFor). Rows carry `budgetDerived` so the UI can label a
 * derived figure.
 */
export function categorySpend(state, key, { mode = "month" } = {}) {
  const spentById = new Map();
  const txns = mode === "week" ? transactionsInWeek(state, key) : transactionsInMonth(state, key);
  for (const t of txns) {
    if (t.kind !== "expense") continue;
    spentById.set(t.categoryId, (spentById.get(t.categoryId) || 0) + t.amountMinor);
  }
  const rows = [];
  for (const category of state.categories) {
    if (category.kind !== "expense") continue;
    const spent = spentById.get(category.id) || 0;
    if (category.archived && spent === 0) continue;
    const resolved =
      mode === "week"
        ? {
            budget:
              category.weeklyBudgetMinor === null || category.weeklyBudgetMinor === undefined
                ? null
                : category.weeklyBudgetMinor,
            derived: false,
          }
        : monthlyBudgetFor(category, key);
    const budget = resolved.budget;
    rows.push({
      category,
      spent,
      budget,
      budgetDerived: resolved.derived,
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
      budgetDerived: false,
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

/** Last `count` weeks ending at `endKey`, oldest first. Default 8: about two months, still readable as paired bars. */
export function weekTrend(state, endKey, count = 8) {
  const keys = [];
  for (let i = count - 1; i >= 0; i--) keys.push(shiftWeek(endKey, -i));
  return keys.map((key) => {
    const s = weekSummary(state, key);
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
  { query = "", kind = "all", categoryId = "all", monthKey = null, weekKey = null } = {}
) {
  const q = query.trim().toLowerCase();
  const categoryById = new Map(state.categories.map((c) => [c.id, c]));
  const accountById = new Map(state.accounts.map((a) => [a.id, a]));
  const out = state.transactions.filter((t) => {
    // A week filter wins over a month filter when both are given; the UI
    // only ever passes one.
    if (weekKey) {
      if (weekKeyOf(t.date) !== weekKey) return false;
    } else if (monthKey && monthKeyOf(t.date) !== monthKey) {
      return false;
    }
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
