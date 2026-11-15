import { describe, expect, it } from "vitest";
import { weekKeyOf } from "./dates.js";
import { blankState } from "./model.js";
import { materializeRules, occurrencesForRule } from "./recurring.js";

function rule(overrides = {}) {
  return {
    id: "rule_1",
    kind: "expense",
    amountMinor: 10000,
    categoryId: "cat_1",
    accountId: null,
    memberId: "member_1",
    note: "Rent",
    frequency: "monthly",
    startDate: "2026-01-15",
    endDate: null,
    dayOfMonth: 15,
    weekday: null,
    active: true,
    createdAt: "",
    ...overrides,
  };
}

describe("occurrencesForRule", () => {
  it("generates monthly occurrences on the chosen day", () => {
    expect(occurrencesForRule(rule(), "2026-04-30")).toEqual([
      "2026-01-15",
      "2026-02-15",
      "2026-03-15",
      "2026-04-15",
    ]);
  });

  it("clamps day-of-month to short months", () => {
    const r = rule({ startDate: "2026-01-31", dayOfMonth: 31 });
    expect(occurrencesForRule(r, "2026-03-31")).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("respects end dates and inactive rules", () => {
    expect(occurrencesForRule(rule({ endDate: "2026-02-15" }), "2026-06-01")).toEqual([
      "2026-01-15",
      "2026-02-15",
    ]);
    expect(occurrencesForRule(rule({ active: false }), "2026-06-01")).toEqual([]);
  });

  it("generates weekly occurrences on the start weekday", () => {
    // 2026-01-05 is a Monday.
    const r = rule({ frequency: "weekly", startDate: "2026-01-05", dayOfMonth: null });
    expect(occurrencesForRule(r, "2026-01-31")).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
      "2026-01-26",
    ]);
  });

  it("starts weekly rules on the next matching weekday", () => {
    // Start Wednesday 2026-01-07, weekday Friday (5).
    const r = rule({ frequency: "weekly", startDate: "2026-01-07", weekday: 5, dayOfMonth: null });
    expect(occurrencesForRule(r, "2026-01-31")).toEqual([
      "2026-01-09",
      "2026-01-16",
      "2026-01-23",
      "2026-01-30",
    ]);
  });

  it("returns nothing when the rule starts after the horizon", () => {
    expect(occurrencesForRule(rule({ startDate: "2027-01-01" }), "2026-06-01")).toEqual([]);
  });

  it("lands weekly occurrences in consecutive week groups", () => {
    // A weekly rule's entries must group one per week under Monday-start
    // week keys, including across the year boundary.
    const r = rule({ frequency: "weekly", startDate: "2026-12-28", dayOfMonth: null });
    const dates = occurrencesForRule(r, "2027-01-12");
    expect(dates).toEqual(["2026-12-28", "2027-01-04", "2027-01-11"]);
    expect(dates.map(weekKeyOf)).toEqual(["2026-W53", "2027-W01", "2027-W02"]);
  });
});

describe("materializeRules", () => {
  it("generates each period once, even when called repeatedly", () => {
    const state = blankState();
    state.rules = [rule()];
    const first = materializeRules(state, "2026-03-31", { now: "2026-03-31T00:00:00.000Z" });
    expect(first).toHaveLength(3);
    expect(first[0].periodKey).toBe("rule_1:2026-01");
    expect(first[0].amountMinor).toBe(10000);
    state.transactions = first;
    const second = materializeRules(state, "2026-03-31");
    expect(second).toHaveLength(0);
    const third = materializeRules(state, "2026-05-31");
    expect(third.map((t) => t.date)).toEqual(["2026-04-15", "2026-05-15"]);
  });

  it("skips rules that are inactive", () => {
    const state = blankState();
    state.rules = [rule({ active: false })];
    expect(materializeRules(state, "2026-12-31")).toHaveLength(0);
  });
});
