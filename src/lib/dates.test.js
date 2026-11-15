import { describe, expect, it } from "vitest";
import {
  addDays,
  currentWeekKey,
  parseLooseDate,
  shiftWeek,
  weekKeyOf,
  weekKeyParts,
  weekLabel,
  weekProgress,
  weekRange,
  weekShortLabel,
} from "./dates.js";

describe("parseLooseDate", () => {
  it("passes ISO dates through unchanged", () => {
    expect(parseLooseDate("2026-11-15")).toBe("2026-11-15");
    expect(parseLooseDate("2026-02-29")).toBe(null); // 2026 is not a leap year
  });

  it("accepts UK day/month/year dates, including single digits", () => {
    expect(parseLooseDate("15/11/2026")).toBe("2026-11-15");
    expect(parseLooseDate("5/1/2026")).toBe("2026-01-05");
    expect(parseLooseDate("29/02/2028")).toBe("2028-02-29");
  });

  it("rejects impossible or wrongly shaped dates", () => {
    expect(parseLooseDate("31/02/2026")).toBe(null);
    expect(parseLooseDate("32/01/2026")).toBe(null);
    expect(parseLooseDate("15/13/2026")).toBe(null);
    expect(parseLooseDate("29/02/2026")).toBe(null);
    expect(parseLooseDate("2026/11/15")).toBe(null);
    expect(parseLooseDate("15-11-2026")).toBe(null);
    expect(parseLooseDate("not-a-date")).toBe(null);
    expect(parseLooseDate("")).toBe(null);
    expect(parseLooseDate(null)).toBe(null);
  });
});

describe("weekKeyOf", () => {
  it("groups Monday to Sunday under one key", () => {
    // 9 Nov 2026 is a Monday, 15 Nov the following Sunday.
    expect(weekKeyOf("2026-11-09")).toBe("2026-W46");
    expect(weekKeyOf("2026-11-15")).toBe("2026-W46");
    expect(weekKeyOf("2026-11-16")).toBe("2026-W47");
  });

  it("puts the first Thursday's week first (ISO 8601)", () => {
    // 1 Jan 2026 is a Thursday, so its week is W01 — and the Monday
    // before it (29 Dec 2025) belongs to 2026's W01, not 2025's.
    expect(weekKeyOf("2026-01-01")).toBe("2026-W01");
    expect(weekKeyOf("2025-12-29")).toBe("2026-W01");
    expect(weekKeyOf("2025-12-28")).toBe("2025-W52");
  });

  it("handles 53-week years", () => {
    // 2026 starts on a Thursday, so it has 53 ISO weeks.
    expect(weekKeyOf("2026-12-28")).toBe("2026-W53");
    expect(weekKeyOf("2027-01-01")).toBe("2026-W53");
    expect(weekKeyOf("2027-01-03")).toBe("2026-W53");
    expect(weekKeyOf("2027-01-04")).toBe("2027-W01");
  });

  it("handles year boundaries in both directions", () => {
    expect(weekKeyOf("2029-01-01")).toBe("2029-W01"); // Monday
    expect(weekKeyOf("2028-12-31")).toBe("2028-W52"); // Sunday, 52-week year
    expect(weekKeyOf("2028-12-25")).toBe("2028-W52"); // Monday of that week
  });

  it("returns null for invalid dates", () => {
    expect(weekKeyOf("not-a-date")).toBeNull();
    expect(weekKeyOf("2026-02-30")).toBeNull();
    expect(weekKeyOf("")).toBeNull();
  });
});

describe("weekKeyParts", () => {
  it("parses valid keys and rejects the rest", () => {
    expect(weekKeyParts("2026-W46")).toEqual({ year: 2026, week: 46 });
    expect(weekKeyParts("2026-W01")).toEqual({ year: 2026, week: 1 });
    expect(weekKeyParts("2026-11")).toBeNull();
    expect(weekKeyParts("2026-W00")).toBeNull();
    expect(weekKeyParts("2026-W54")).toBeNull();
    expect(weekKeyParts("2026-w46")).toBeNull();
  });
});

describe("weekRange", () => {
  it("returns the Monday and Sunday of a week", () => {
    expect(weekRange("2026-W46")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    expect(weekRange("2026-W01")).toEqual({ start: "2025-12-29", end: "2026-01-04" });
    expect(weekRange("2026-W53")).toEqual({ start: "2026-12-28", end: "2027-01-03" });
  });

  it("rejects a W53 in a 52-week year", () => {
    expect(weekRange("2025-W53")).toBeNull();
    expect(weekRange("2028-W53")).toBeNull();
  });

  it("rejects malformed keys", () => {
    expect(weekRange("2026-11")).toBeNull();
    expect(weekRange("garbage")).toBeNull();
  });
});

describe("shiftWeek", () => {
  it("moves by whole weeks across month and year boundaries", () => {
    expect(shiftWeek("2026-W46", 1)).toBe("2026-W47");
    expect(shiftWeek("2026-W46", -1)).toBe("2026-W45");
    expect(shiftWeek("2026-W52", 1)).toBe("2026-W53");
    expect(shiftWeek("2026-W53", 1)).toBe("2027-W01");
    expect(shiftWeek("2026-W01", -1)).toBe("2025-W52");
    expect(shiftWeek("2026-W46", 0)).toBe("2026-W46");
  });

  it("returns the input unchanged when invalid", () => {
    expect(shiftWeek("garbage", 1)).toBe("garbage");
    expect(shiftWeek("2025-W53", 1)).toBe("2025-W53");
  });
});

describe("weekLabel", () => {
  it("compresses a week inside one month", () => {
    expect(weekLabel("2026-W46")).toBe("9–15 Nov 2026");
  });

  it("spells out both months when a week straddles them", () => {
    expect(weekLabel("2026-W49")).toBe("30 Nov – 6 Dec 2026");
  });

  it("spells out both years when a week straddles them", () => {
    expect(weekLabel("2026-W01")).toBe("29 Dec 2025 – 4 Jan 2026");
  });

  it("falls back to the key when invalid", () => {
    expect(weekLabel("garbage")).toBe("garbage");
  });
});

describe("weekShortLabel", () => {
  it("names the week's Monday", () => {
    expect(weekShortLabel("2026-W46")).toBe("9 Nov");
    expect(weekShortLabel("2026-W01")).toBe("29 Dec");
  });
});

describe("currentWeekKey", () => {
  it("derives the week from a given date", () => {
    expect(currentWeekKey(new Date(2026, 10, 15))).toBe("2026-W46");
    expect(currentWeekKey(new Date(2026, 0, 1))).toBe("2026-W01");
  });
});

describe("weekProgress", () => {
  it("counts the current day as elapsed, like monthProgress", () => {
    expect(weekProgress("2026-W46", "2026-11-09")).toBeCloseTo(1 / 7);
    expect(weekProgress("2026-W46", "2026-11-15")).toBe(1);
    expect(weekProgress("2026-W46", "2026-11-08")).toBe(0);
    expect(weekProgress("2026-W46", "2026-11-16")).toBe(1);
    expect(weekProgress("garbage", "2026-11-09")).toBe(0);
  });
});

describe("addDays", () => {
  it("shifts dates across month, year and leap boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-11-09", 7)).toBe("2026-11-16");
    expect(addDays("garbage", 1)).toBe("garbage");
  });
});
