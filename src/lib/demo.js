// Optional demo data. Never loaded automatically: the user opts in from
// onboarding or the Data view, it is always labelled as demo, and it can be
// removed in one tap. Every demo transaction, account and category carries
// demo: true so removal never touches real entries.
//
// The figures are deliberately round and generic — plainly illustrative,
// not anyone's real budget.

import { clampDay, shiftMonth } from "./dates.js";
import { blankAccount, blankCategory, blankState } from "./model.js";
import { newId } from "./ids.js";

function txn(state, date, kind, amountMinor, categoryName, note, accountName = null) {
  const category = state.categories.find((c) => c.name === categoryName) || null;
  const account = accountName
    ? state.accounts.find((a) => a.name === accountName) || null
    : null;
  return {
    id: newId("txn"),
    date,
    kind,
    amountMinor,
    categoryId: category?.id ?? null,
    accountId: account?.id ?? null,
    memberId: state.members[0].id,
    note,
    ruleId: null,
    periodKey: null,
    createdAt: "",
    updatedAt: "",
    demo: true,
  };
}

/**
 * Build a demo state anchored at `monthKey` (the current month) with two
 * preceding months of history. Pure and deterministic for a given key.
 */
export function buildDemoState(monthKey) {
  const state = blankState();
  state.prefs.demo = true;
  state.accounts = [
    { ...blankAccount("Holiday fund", 2), targetMinor: 120000, demo: true },
    { ...blankAccount("Emergency fund", 3), targetMinor: 300000, demo: true },
  ];

  const months = [shiftMonth(monthKey, -2), shiftMonth(monthKey, -1), monthKey];
  const txns = [];
  for (const [i, key] of months.entries()) {
    const [y, m] = key.split("-").map(Number);
    const d = (day) => clampDay(y, m, day);
    const older = i < 2;
    txns.push(
      txn(state, d(1), "income", 290000, "Salary", "Monthly pay"),
      txn(state, d(1), "expense", 95000, "Rent", "Monthly rent"),
      txn(state, d(2), "expense", 14500, "Bills", "Energy and council tax"),
      txn(state, d(3), "expense", 1299, "Subscriptions", "Music and streaming"),
      txn(state, d(5), "expense", 6420, "Groceries", "Weekly shop"),
      txn(state, d(7), "expense", 4800, "Transport", "Travelcard top-up"),
      txn(state, d(9), "expense", 3250, "Eating out", "Dinner with friends"),
      txn(state, d(12), "expense", 5875, "Groceries", "Weekly shop"),
      txn(state, d(14), "expense", 8999, "Shopping", "New trainers"),
      txn(state, d(16), "expense", 2100, "Health", "Pharmacy"),
      txn(state, d(19), "expense", 6100, "Groceries", "Weekly shop"),
      txn(state, d(21), "saving", 20000, null, "Payday transfer", "Holiday fund"),
      txn(state, d(21), "saving", 10000, null, "Payday transfer", "Emergency fund"),
      txn(state, d(23), "expense", 2800, "Eating out", "Lunch out"),
      txn(state, d(26), "expense", 5540, "Groceries", "Weekly shop")
    );
    if (older) {
      txns.push(txn(state, d(28), "expense", 1800, "Transport", "Bus fares"));
    }
  }
  state.transactions = txns;
  return state;
}

/** Remove every demo-flagged transaction and demo account. Real data is untouched. */
export function stripDemoData(state) {
  const transactions = state.transactions.filter((t) => !t.demo);
  const usedAccountIds = new Set(
    transactions.filter((t) => t.accountId).map((t) => t.accountId)
  );
  const accounts = state.accounts.filter(
    (a) => !a.demo || usedAccountIds.has(a.id)
  );
  return {
    ...state,
    transactions,
    accounts,
    prefs: { ...state.prefs, demo: false },
  };
}
