import { describe, expect, it } from "vitest";
import { migrateLegacy } from "./migrate.js";
import { monthSummary } from "./stats.js";

// A realistic slice of the original app's localStorage shape: two years,
// the default categories plus a custom one, salary, and three savings
// accounts. Figures mirror the old grid's monthly layout.
const LEGACY_SAMPLE = {
  2025: {
    categories: ["Loan", "Rent", "Grocery", "Credit Card"],
    expenses: {
      Loan: { Nov: 450, Dec: 450 },
      Rent: { Nov: 1025, Dec: 1025 },
      Grocery: { Nov: 210.5, Dec: 188.2 },
      "Credit Card": { Nov: 320 },
    },
    salary: { Nov: 3600, Dec: 3600 },
    savings: {
      ISA: { Nov: 200, Dec: 200 },
      Revolut: { Nov: 50 },
    },
  },
  2026: {
    categories: ["Loan", "Loan P", "SIM", "Rent", "Grocery", "Flex P", "Credit Card", "Subscriptions"],
    expenses: {
      Loan: { Jan: 450, Feb: 450, Mar: 0 },
      "Loan P": { Jan: 120 },
      SIM: { Jan: 15, Feb: 15 },
      Rent: { Jan: 1025, Feb: 1025 },
      Grocery: { Jan: 240.75, Feb: 198.4 },
      "Flex P": { Jan: 89.99 },
      "Credit Card": { Jan: 410.2, Feb: 0 },
      Subscriptions: { Jan: 32.97, Feb: 32.97 },
      "One-off category": { Feb: 75 },
    },
    salary: { Jan: 3620.5, Feb: 3620.5 },
    savings: {
      ISA: { Jan: 250, Feb: 250 },
      Revolut: { Jan: 50, Feb: 50 },
      "Monzo 1P": { Jan: 12.4, Feb: 11.9 },
    },
  },
};

describe("migrateLegacy", () => {
  it("migrates every nonzero figure to a dated transaction", () => {
    const { state, report } = migrateLegacy(LEGACY_SAMPLE, { now: "2026-11-15T00:00:00.000Z" });
    expect(report.hadData).toBe(true);
    expect(report.years).toBe(2);
    // 2025: 7 expenses + 2 salary + 3 savings = 12; 2026: 14 expenses + 2 salary + 6 savings = 22
    expect(report.transactions).toBe(34);
    expect(state.transactions).toHaveLength(34);
    expect(report.skipped).toBe(2); // the two explicit 0 values
  });

  it("unions categories across years and adds Salary as income", () => {
    const { state, report } = migrateLegacy(LEGACY_SAMPLE);
    const names = state.categories.map((c) => c.name);
    expect(names).toContain("Loan");
    expect(names).toContain("One-off category");
    expect(names).toContain("Salary");
    expect(state.categories.find((c) => c.name === "Salary").kind).toBe("income");
    expect(state.categories.find((c) => c.name === "Rent").kind).toBe("expense");
    expect(report.categories).toBe(state.categories.length);
  });

  it("creates one account per savings key", () => {
    const { state, report } = migrateLegacy(LEGACY_SAMPLE);
    expect(state.accounts.map((a) => a.name).sort()).toEqual(["ISA", "Monzo 1P", "Revolut"]);
    expect(report.accounts).toBe(3);
  });

  it("preserves monthly totals exactly", () => {
    const { state } = migrateLegacy(LEGACY_SAMPLE);
    const jan = monthSummary(state, "2026-01");
    expect(jan.income).toBe(362050);
    // 450 + 120 + 15 + 1025 + 240.75 + 89.99 + 410.20 + 32.97 = 2383.91
    expect(jan.expenses).toBe(238391);
    expect(jan.savings).toBe(25000 + 5000 + 1240);
    expect(jan.left).toBe(362050 - 238391);
    const nov = monthSummary(state, "2025-11");
    expect(nov.income).toBe(360000);
    expect(nov.expenses).toBe(45000 + 102500 + 21050 + 32000);
  });

  it("dates everything the 1st and labels it as imported", () => {
    const { state } = migrateLegacy(LEGACY_SAMPLE);
    expect(state.transactions.every((t) => t.date.endsWith("-01"))).toBe(true);
    expect(state.transactions.every((t) => t.note === "Imported from the previous MyBudget")).toBe(true);
  });

  it("records migration metadata and leaves the input untouched", () => {
    const snapshot = JSON.stringify(LEGACY_SAMPLE);
    const { state } = migrateLegacy(LEGACY_SAMPLE, { now: "2026-11-15T00:00:00.000Z" });
    expect(state.meta.migratedFrom).toBe("budget_final");
    expect(state.meta.migratedAt).toBe("2026-11-15T00:00:00.000Z");
    expect(JSON.stringify(LEGACY_SAMPLE)).toBe(snapshot);
  });

  it("handles empty, missing and malformed input without throwing", () => {
    expect(migrateLegacy({}).report.hadData).toBe(false);
    expect(migrateLegacy(null).report.hadData).toBe(false);
    expect(migrateLegacy("nope").report.hadData).toBe(false);
    expect(migrateLegacy({ 2026: null }).report.hadData).toBe(false);
    expect(migrateLegacy({ 2026: { categories: "not-an-array" } }).report.hadData).toBe(true);
  });

  it("skips negative and non-numeric figures and counts them", () => {
    const { report } = migrateLegacy({
      2026: {
        categories: ["Rent"],
        expenses: { Rent: { Jan: -50, Feb: "abc", Mar: 100 } },
        salary: {},
        savings: {},
      },
    });
    expect(report.transactions).toBe(1);
    expect(report.skipped).toBe(2);
  });
});
