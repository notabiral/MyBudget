import { describe, expect, it } from "vitest";
import { blankState } from "./model.js";
import {
  accountBalance,
  categorySpend,
  filterTransactions,
  monthSummary,
  monthlyBudgetFor,
  runningBalance,
  trend,
  weekSummary,
  weekTrend,
  yearSeries,
} from "./stats.js";

function stateWithTxns(txns) {
  const state = blankState();
  state.transactions = txns.map((t, i) => ({
    id: `txn_${i}`,
    categoryId: null,
    accountId: null,
    memberId: state.members[0].id,
    note: "",
    ruleId: null,
    periodKey: null,
    createdAt: "",
    updatedAt: "",
    ...t,
  }));
  return state;
}

const RENT = "cat_rent";
const FOOD = "cat_food";

function stateWithCategories() {
  const state = blankState();
  state.categories = [
    { id: RENT, name: "Rent", kind: "expense", color: "#000", monthlyBudgetMinor: 100000, archived: false },
    { id: FOOD, name: "Groceries", kind: "expense", color: "#111", monthlyBudgetMinor: 30000, archived: false },
    { id: "cat_sal", name: "Salary", kind: "income", color: "#222", monthlyBudgetMinor: null, archived: false },
  ];
  return state;
}

describe("monthSummary", () => {
  it("totals income, expenses, savings and left", () => {
    const state = stateWithTxns([
      { date: "2026-11-01", kind: "income", amountMinor: 300000 },
      { date: "2026-11-05", kind: "expense", amountMinor: 100000 },
      { date: "2026-11-06", kind: "expense", amountMinor: 25000 },
      { date: "2026-11-07", kind: "saving", amountMinor: 20000 },
      { date: "2026-10-15", kind: "expense", amountMinor: 99999 },
    ]);
    const s = monthSummary(state, "2026-11");
    expect(s.income).toBe(300000);
    expect(s.expenses).toBe(125000);
    expect(s.savings).toBe(20000);
    expect(s.left).toBe(175000);
    expect(s.count).toBe(4);
  });

  it("computes spend ratio, 0 with no income", () => {
    const state = stateWithTxns([
      { date: "2026-11-05", kind: "expense", amountMinor: 5000 },
    ]);
    expect(monthSummary(state, "2026-11").spendRatio).toBe(0);
    const withIncome = stateWithTxns([
      { date: "2026-11-01", kind: "income", amountMinor: 20000 },
      { date: "2026-11-05", kind: "expense", amountMinor: 5000 },
    ]);
    expect(monthSummary(withIncome, "2026-11").spendRatio).toBe(0.25);
  });

  it("counts saving withdrawals as negative savings", () => {
    const state = stateWithTxns([
      { date: "2026-11-07", kind: "saving", amountMinor: 20000 },
      { date: "2026-11-20", kind: "saving", amountMinor: -5000 },
    ]);
    expect(monthSummary(state, "2026-11").savings).toBe(15000);
  });
});

describe("monthSummary opening balance and left to spend", () => {
  it("is unchanged for the first recorded month (no opening balance)", () => {
    // Abiral's migrated figures: January 2026 holds everything.
    const state = stateWithTxns([
      { date: "2026-01-01", kind: "income", amountMinor: 334800 },
      { date: "2026-01-01", kind: "expense", amountMinor: 196299 },
    ]);
    const s = monthSummary(state, "2026-01");
    expect(s.opening).toBe(0);
    expect(s.left).toBe(138501);
    expect(s.leftToSpend).toBe(138501);
  });

  it("shows the brought-forward balance in a later empty month", () => {
    const state = stateWithTxns([
      { date: "2026-01-01", kind: "income", amountMinor: 334800 },
      { date: "2026-01-01", kind: "expense", amountMinor: 196299 },
    ]);
    const s = monthSummary(state, "2026-11");
    expect(s.income).toBe(0);
    expect(s.expenses).toBe(0);
    expect(s.left).toBe(0);
    expect(s.opening).toBe(138501);
    expect(s.leftToSpend).toBe(138501);
  });

  it("combines opening balance, income, spending and savings", () => {
    const state = stateWithTxns([
      { date: "2026-09-01", kind: "income", amountMinor: 100000 },
      { date: "2026-09-05", kind: "expense", amountMinor: 60000 },
      { date: "2026-10-01", kind: "income", amountMinor: 100000 },
      { date: "2026-10-05", kind: "expense", amountMinor: 90000 },
      { date: "2026-10-07", kind: "saving", amountMinor: 5000 },
    ]);
    const s = monthSummary(state, "2026-10");
    expect(s.opening).toBe(40000);
    expect(s.left).toBe(10000);
    // 40,000 brought forward + 100,000 in − 90,000 out − 5,000 saved.
    expect(s.leftToSpend).toBe(45000);
    expect(s.leftToSpend).toBe(s.carried);
  });

  it("keeps left month-only while leftToSpend carries history", () => {
    const state = stateWithTxns([
      { date: "2026-10-15", kind: "expense", amountMinor: 99999 },
      { date: "2026-11-01", kind: "income", amountMinor: 300000 },
      { date: "2026-11-05", kind: "expense", amountMinor: 125000 },
      { date: "2026-11-07", kind: "saving", amountMinor: 20000 },
    ]);
    const s = monthSummary(state, "2026-11");
    expect(s.left).toBe(175000);
    expect(s.opening).toBe(-99999);
    expect(s.leftToSpend).toBe(55001);
  });

  it("reconciles savings flows: deposits reduce, withdrawals restore", () => {
    const state = stateWithTxns([
      { date: "2026-10-01", kind: "income", amountMinor: 100000 },
      { date: "2026-11-07", kind: "saving", amountMinor: 20000 },
      { date: "2026-11-20", kind: "saving", amountMinor: -5000 },
    ]);
    const s = monthSummary(state, "2026-11");
    expect(s.savings).toBe(15000);
    expect(s.opening).toBe(100000);
    expect(s.leftToSpend).toBe(85000);
    expect(s.leftToSpend).toBe(s.carried);
  });

  it("counts account opening balances as already set aside", () => {
    const state = stateWithTxns([]);
    state.accounts = [
      { id: "a1", name: "ISA", kind: "savings", targetMinor: null, openingMinor: 50000, color: "#000", archived: false },
    ];
    const s = monthSummary(state, "2026-11");
    expect(s.opening).toBe(-50000);
    expect(s.leftToSpend).toBe(-50000);
  });

  it("carries across the year boundary", () => {
    const state = stateWithTxns([
      { date: "2026-12-01", kind: "income", amountMinor: 100000 },
      { date: "2026-12-05", kind: "expense", amountMinor: 30000 },
    ]);
    const s = monthSummary(state, "2027-01");
    expect(s.opening).toBe(70000);
    expect(s.leftToSpend).toBe(70000);
  });

  it("leftToSpend always equals the running balance through the month", () => {
    const state = stateWithTxns([
      { date: "2026-01-01", kind: "income", amountMinor: 334800 },
      { date: "2026-01-01", kind: "expense", amountMinor: 196299 },
      { date: "2026-03-10", kind: "income", amountMinor: 50000 },
      { date: "2026-03-11", kind: "saving", amountMinor: 10000 },
      { date: "2026-06-01", kind: "expense", amountMinor: 200000 },
    ]);
    for (const key of ["2026-01", "2026-02", "2026-03", "2026-06", "2026-11", "2027-02"]) {
      const s = monthSummary(state, key);
      expect(s.leftToSpend).toBe(s.carried);
    }
  });
});

describe("runningBalance (carried savings)", () => {
  it("carries leftover across months, net of savings", () => {
    const state = stateWithTxns([
      { date: "2026-09-01", kind: "income", amountMinor: 100000 },
      { date: "2026-09-05", kind: "expense", amountMinor: 60000 },
      { date: "2026-10-01", kind: "income", amountMinor: 100000 },
      { date: "2026-10-05", kind: "expense", amountMinor: 90000 },
      { date: "2026-10-07", kind: "saving", amountMinor: 5000 },
      { date: "2026-11-01", kind: "income", amountMinor: 100000 },
    ]);
    expect(runningBalance(state, "2026-09")).toBe(40000);
    expect(runningBalance(state, "2026-10")).toBe(45000);
    expect(runningBalance(state, "2026-11")).toBe(145000);
  });

  it("ignores months after the key", () => {
    const state = stateWithTxns([
      { date: "2027-01-01", kind: "income", amountMinor: 50000 },
    ]);
    expect(runningBalance(state, "2026-12")).toBe(0);
  });

  it("subtracts account opening balances", () => {
    const state = stateWithTxns([]);
    state.accounts = [
      { id: "a1", name: "ISA", kind: "savings", targetMinor: null, openingMinor: 50000, color: "#000", archived: false },
    ];
    expect(runningBalance(state, "2026-11")).toBe(-50000);
  });
});

describe("yearSeries (legacy Auto Savings)", () => {
  it("carries extra within the year, matching the old grid", () => {
    const state = stateWithTxns([
      { date: "2026-01-01", kind: "income", amountMinor: 100000 },
      { date: "2026-01-05", kind: "expense", amountMinor: 60000 },
      { date: "2026-02-01", kind: "income", amountMinor: 100000 },
      { date: "2026-02-05", kind: "expense", amountMinor: 110000 },
    ]);
    const series = yearSeries(state, 2026);
    expect(series[0].extra).toBe(40000);
    expect(series[0].carriedExtra).toBe(40000);
    expect(series[1].extra).toBe(-10000);
    expect(series[1].carriedExtra).toBe(30000);
    expect(series[2].carriedExtra).toBe(30000);
  });
});

describe("categorySpend", () => {
  it("rolls spend up per category with budget and remaining", () => {
    const state = stateWithCategories();
    state.transactions = [
      { id: "t1", date: "2026-11-01", kind: "expense", amountMinor: 100000, categoryId: RENT, accountId: null, memberId: state.members[0].id, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
      { id: "t2", date: "2026-11-02", kind: "expense", amountMinor: 35000, categoryId: FOOD, accountId: null, memberId: state.members[0].id, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
    ];
    const rows = categorySpend(state, "2026-11");
    const rent = rows.find((r) => r.category?.id === RENT);
    const food = rows.find((r) => r.category?.id === FOOD);
    expect(rent.spent).toBe(100000);
    expect(rent.remaining).toBe(0);
    expect(rent.over).toBe(false);
    expect(food.spent).toBe(35000);
    expect(food.remaining).toBe(-5000);
    expect(food.over).toBe(true);
  });

  it("sorts by spend descending", () => {
    const state = stateWithCategories();
    state.transactions = [
      { id: "t1", date: "2026-11-01", kind: "expense", amountMinor: 1000, categoryId: RENT, accountId: null, memberId: state.members[0].id, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
      { id: "t2", date: "2026-11-02", kind: "expense", amountMinor: 9000, categoryId: FOOD, accountId: null, memberId: state.members[0].id, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
    ];
    const rows = categorySpend(state, "2026-11");
    expect(rows[0].category.id).toBe(FOOD);
  });
});

describe("accountBalance", () => {
  it("adds opening balance and signed saving transactions", () => {
    const state = stateWithTxns([
      { date: "2026-11-07", kind: "saving", amountMinor: 20000, accountId: "a1" },
      { date: "2026-11-20", kind: "saving", amountMinor: -5000, accountId: "a1" },
      { date: "2026-11-21", kind: "saving", amountMinor: 99999, accountId: "a2" },
    ]);
    state.accounts = [
      { id: "a1", name: "ISA", kind: "savings", targetMinor: null, openingMinor: 100000, color: "#000", archived: false },
      { id: "a2", name: "Other", kind: "savings", targetMinor: null, openingMinor: 0, color: "#000", archived: false },
    ];
    expect(accountBalance(state, "a1")).toBe(115000);
    expect(accountBalance(state, "a2")).toBe(99999);
    expect(accountBalance(state, "missing")).toBe(0);
  });
});

describe("trend", () => {
  it("returns the last n months oldest first", () => {
    const state = stateWithTxns([
      { date: "2026-11-01", kind: "income", amountMinor: 1000 },
    ]);
    const t = trend(state, "2026-11", 3);
    expect(t.map((m) => m.key)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(t[2].income).toBe(1000);
    expect(t[0].income).toBe(0);
  });
});

describe("weekSummary", () => {
  it("totals only the Monday-to-Sunday range", () => {
    const state = stateWithTxns([
      { date: "2026-11-08", kind: "income", amountMinor: 99999 }, // previous Sunday
      { date: "2026-11-09", kind: "income", amountMinor: 300000 }, // Monday
      { date: "2026-11-15", kind: "expense", amountMinor: 50000 }, // Sunday
      { date: "2026-11-16", kind: "expense", amountMinor: 99999 }, // next Monday
    ]);
    const s = weekSummary(state, "2026-W46");
    expect(s.income).toBe(300000);
    expect(s.expenses).toBe(50000);
    expect(s.count).toBe(2);
  });

  it("brings forward the balance through the previous week", () => {
    const state = stateWithTxns([
      { date: "2026-01-01", kind: "income", amountMinor: 334800 },
      { date: "2026-01-01", kind: "expense", amountMinor: 196299 },
    ]);
    const s = weekSummary(state, "2026-W46");
    expect(s.income).toBe(0);
    expect(s.opening).toBe(138501);
    expect(s.leftToSpend).toBe(138501);
    expect(s.leftToSpend).toBe(s.carried);
  });

  it("counts the week before the first transaction as empty, not negative", () => {
    const state = stateWithTxns([
      { date: "2026-11-09", kind: "income", amountMinor: 100000 },
    ]);
    const s = weekSummary(state, "2026-W45");
    expect(s.opening).toBe(0);
    expect(s.leftToSpend).toBe(0);
  });

  it("combines opening balance, income, spending and savings", () => {
    const state = stateWithTxns([
      { date: "2026-11-02", kind: "income", amountMinor: 100000 },
      { date: "2026-11-03", kind: "expense", amountMinor: 60000 },
      { date: "2026-11-09", kind: "income", amountMinor: 100000 },
      { date: "2026-11-10", kind: "expense", amountMinor: 90000 },
      { date: "2026-11-11", kind: "saving", amountMinor: 5000 },
    ]);
    const s = weekSummary(state, "2026-W46");
    expect(s.opening).toBe(40000);
    expect(s.left).toBe(10000);
    expect(s.leftToSpend).toBe(45000);
    expect(s.leftToSpend).toBe(s.carried);
  });

  it("carries across the year boundary, including week 53", () => {
    const state = stateWithTxns([
      { date: "2026-12-28", kind: "income", amountMinor: 100000 },
      { date: "2026-12-29", kind: "expense", amountMinor: 30000 },
    ]);
    expect(weekSummary(state, "2026-W53").leftToSpend).toBe(70000);
    const next = weekSummary(state, "2027-W01");
    expect(next.opening).toBe(70000);
    expect(next.leftToSpend).toBe(70000);
  });

  it("leftToSpend always equals the running balance through the week", () => {
    const state = stateWithTxns([
      { date: "2026-01-01", kind: "income", amountMinor: 334800 },
      { date: "2026-01-01", kind: "expense", amountMinor: 196299 },
      { date: "2026-03-10", kind: "income", amountMinor: 50000 },
      { date: "2026-03-11", kind: "saving", amountMinor: 10000 },
      { date: "2026-06-01", kind: "expense", amountMinor: 200000 },
    ]);
    for (const key of ["2026-W01", "2026-W02", "2026-W11", "2026-W23", "2026-W46", "2027-W01"]) {
      const s = weekSummary(state, key);
      expect(s.leftToSpend).toBe(s.carried);
    }
  });

  it("returns zeros for an invalid week key", () => {
    const state = stateWithTxns([
      { date: "2026-11-09", kind: "income", amountMinor: 100000 },
    ]);
    const s = weekSummary(state, "2025-W53");
    expect(s.income).toBe(0);
    expect(s.leftToSpend).toBe(0);
  });
});

describe("weekTrend", () => {
  it("returns the last n weeks oldest first", () => {
    const state = stateWithTxns([
      { date: "2026-11-09", kind: "income", amountMinor: 1000 },
    ]);
    const t = weekTrend(state, "2026-W46", 3);
    expect(t.map((w) => w.key)).toEqual(["2026-W44", "2026-W45", "2026-W46"]);
    expect(t[2].income).toBe(1000);
    expect(t[0].income).toBe(0);
  });

  it("defaults to 8 weeks", () => {
    expect(weekTrend(stateWithTxns([]), "2026-W46")).toHaveLength(8);
  });

  it("crosses the year boundary", () => {
    const t = weekTrend(stateWithTxns([]), "2027-W01", 3);
    expect(t.map((w) => w.key)).toEqual(["2026-W52", "2026-W53", "2027-W01"]);
  });
});

describe("monthlyBudgetFor (weekly collapse rule)", () => {
  it("prefers an explicit monthly amount over the weekly one", () => {
    const category = { monthlyBudgetMinor: 30000, weeklyBudgetMinor: 10000 };
    expect(monthlyBudgetFor(category, "2026-11")).toEqual({ budget: 30000, derived: false });
  });

  it("derives from the weekly amount by days in the month", () => {
    const category = { monthlyBudgetMinor: null, weeklyBudgetMinor: 10000 };
    // 30 days: 10000 × 30 / 7 = 42857.14 → 42857.
    expect(monthlyBudgetFor(category, "2026-11")).toEqual({ budget: 42857, derived: true });
    // 31 days: 10000 × 31 / 7 = 44285.71 → 44286.
    expect(monthlyBudgetFor(category, "2026-10")).toEqual({ budget: 44286, derived: true });
  });

  it("derives exactly for a 28-day February", () => {
    const category = { monthlyBudgetMinor: null, weeklyBudgetMinor: 10000 };
    expect(monthlyBudgetFor(category, "2026-02")).toEqual({ budget: 40000, derived: true });
  });

  it("derives with rounding for a leap February", () => {
    const category = { monthlyBudgetMinor: null, weeklyBudgetMinor: 10000 };
    // 29 days: 10000 × 29 / 7 = 41428.57 → 41429.
    expect(monthlyBudgetFor(category, "2028-02")).toEqual({ budget: 41429, derived: true });
  });

  it("returns null when neither amount is set", () => {
    expect(monthlyBudgetFor({ monthlyBudgetMinor: null, weeklyBudgetMinor: null }, "2026-11")).toEqual(
      { budget: null, derived: false }
    );
    // Old saved shapes lack the weekly field entirely.
    expect(monthlyBudgetFor({ monthlyBudgetMinor: null }, "2026-11")).toEqual(
      { budget: null, derived: false }
    );
  });

  it("returns null for an invalid month key", () => {
    expect(monthlyBudgetFor({ monthlyBudgetMinor: null, weeklyBudgetMinor: 10000 }, "garbage")).toEqual(
      { budget: null, derived: false }
    );
  });
});

describe("categorySpend in week mode and with derived budgets", () => {
  function stateWithWeeklyBudgets() {
    const state = blankState();
    state.categories = [
      { id: RENT, name: "Rent", kind: "expense", color: "#000", monthlyBudgetMinor: null, weeklyBudgetMinor: 20000, archived: false },
      { id: FOOD, name: "Groceries", kind: "expense", color: "#111", monthlyBudgetMinor: 30000, weeklyBudgetMinor: 10000, archived: false },
    ];
    return state;
  }

  it("scopes spend to the week and uses weekly budgets", () => {
    const state = stateWithWeeklyBudgets();
    state.transactions = [
      { id: "t1", date: "2026-11-08", kind: "expense", amountMinor: 99999, categoryId: RENT, accountId: null, memberId: state.members[0].id, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
      { id: "t2", date: "2026-11-10", kind: "expense", amountMinor: 25000, categoryId: RENT, accountId: null, memberId: state.members[0].id, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
    ];
    const rows = categorySpend(state, "2026-W46", { mode: "week" });
    const rent = rows.find((r) => r.category?.id === RENT);
    expect(rent.spent).toBe(25000);
    expect(rent.budget).toBe(20000);
    expect(rent.budgetDerived).toBe(false);
    expect(rent.over).toBe(true);
  });

  it("shows derived monthly budgets in month mode, flagged as derived", () => {
    const state = stateWithWeeklyBudgets();
    state.transactions = [
      { id: "t1", date: "2026-11-10", kind: "expense", amountMinor: 10000, categoryId: RENT, accountId: null, memberId: state.members[0].id, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
      { id: "t2", date: "2026-11-10", kind: "expense", amountMinor: 10000, categoryId: FOOD, accountId: null, memberId: state.members[0].id, note: "", ruleId: null, periodKey: null, createdAt: "", updatedAt: "" },
    ];
    const rows = categorySpend(state, "2026-11");
    const rent = rows.find((r) => r.category?.id === RENT);
    const food = rows.find((r) => r.category?.id === FOOD);
    // Rent: 20000 × 30 / 7 = 85714.29 → 85714, derived.
    expect(rent.budget).toBe(85714);
    expect(rent.budgetDerived).toBe(true);
    // Groceries: explicit monthly wins, not derived.
    expect(food.budget).toBe(30000);
    expect(food.budgetDerived).toBe(false);
  });
});

describe("filterTransactions with a week key", () => {
  it("scopes to the selected week", () => {
    const state = stateWithTxns([
      { date: "2026-11-08", kind: "expense", amountMinor: 100 },
      { date: "2026-11-09", kind: "expense", amountMinor: 200 },
      { date: "2026-11-15", kind: "expense", amountMinor: 300 },
      { date: "2026-11-16", kind: "expense", amountMinor: 400 },
    ]);
    const out = filterTransactions(state, { weekKey: "2026-W46" });
    expect(out.map((t) => t.amountMinor).sort()).toEqual([200, 300]);
  });

  it("prefers the week key when both keys are given", () => {
    const state = stateWithTxns([
      { date: "2026-11-02", kind: "expense", amountMinor: 100 },
      { date: "2026-11-09", kind: "expense", amountMinor: 200 },
    ]);
    const out = filterTransactions(state, { monthKey: "2026-11", weekKey: "2026-W46" });
    expect(out).toHaveLength(1);
    expect(out[0].amountMinor).toBe(200);
  });
});
