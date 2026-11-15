import { describe, expect, it } from "vitest";
import { blankCategory, blankState, normalizeState } from "./model.js";

describe("weekly budgets in the model", () => {
  it("blank categories carry a null weekly budget", () => {
    expect(blankCategory("Groceries", "expense").weeklyBudgetMinor).toBeNull();
    expect(blankState().categories[0].weeklyBudgetMinor).toBeNull();
  });

  it("normalizeState keeps a valid weekly budget", () => {
    const input = blankState();
    input.categories[0].weeklyBudgetMinor = 5000;
    expect(normalizeState(input).categories[0].weeklyBudgetMinor).toBe(5000);
  });

  it("normalizeState drops invalid weekly budgets", () => {
    const input = blankState();
    input.categories[0].weeklyBudgetMinor = -5;
    input.categories[1].weeklyBudgetMinor = "fifty";
    const out = normalizeState(input);
    expect(out.categories[0].weeklyBudgetMinor).toBeNull();
    expect(out.categories[1].weeklyBudgetMinor).toBeNull();
  });

  it("old saved states without the field normalise to null", () => {
    const input = blankState();
    delete input.categories[0].weeklyBudgetMinor;
    const out = normalizeState(input);
    expect(out.categories[0].weeklyBudgetMinor).toBeNull();
    // The monthly budget on the same category is untouched.
    input.categories[0].monthlyBudgetMinor = 30000;
    expect(normalizeState(input).categories[0].monthlyBudgetMinor).toBe(30000);
  });
});

describe("period mode preference", () => {
  it("defaults to month", () => {
    expect(blankState().prefs.periodMode).toBe("month");
  });

  it("normalizeState keeps week or month and defaults anything else to month", () => {
    const asWeek = blankState();
    asWeek.prefs.periodMode = "week";
    expect(normalizeState(asWeek).prefs.periodMode).toBe("week");

    const missing = blankState();
    delete missing.prefs.periodMode;
    expect(normalizeState(missing).prefs.periodMode).toBe("month");

    const garbage = blankState();
    garbage.prefs.periodMode = "fortnight";
    expect(normalizeState(garbage).prefs.periodMode).toBe("month");
  });

  it("keeps the demo flag alongside the period mode", () => {
    const input = blankState();
    input.prefs = { demo: true, periodMode: "week" };
    const out = normalizeState(input);
    expect(out.prefs).toEqual({ demo: true, periodMode: "week" });
  });
});
