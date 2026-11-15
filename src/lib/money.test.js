import { describe, expect, it } from "vitest";
import { formatMoney, formatMoneyShort, formatPercent, parseMoney, poundsToMinor } from "./money.js";

describe("parseMoney", () => {
  it("parses plain pounds", () => {
    expect(parseMoney("12")).toBe(1200);
    expect(parseMoney("12.34")).toBe(1234);
    expect(parseMoney("0.99")).toBe(99);
  });
  it("strips currency symbols, commas and spaces", () => {
    expect(parseMoney("£1,200.50")).toBe(120050);
    expect(parseMoney("$5")).toBe(500);
    expect(parseMoney(" 42 ")).toBe(4200);
  });
  it("handles negatives", () => {
    expect(parseMoney("-5")).toBe(-500);
    expect(parseMoney("-0.50")).toBe(-50);
  });
  it("rounds half away from zero at the third decimal", () => {
    expect(parseMoney("10.005")).toBe(1001);
    expect(parseMoney("10.004")).toBe(1000);
  });
  it("rejects non-numbers", () => {
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("12.34.56")).toBeNull();
    expect(parseMoney(null)).toBeNull();
    expect(parseMoney("1e3")).toBeNull();
  });
});

describe("poundsToMinor", () => {
  it("converts legacy floats without drift", () => {
    expect(poundsToMinor(49.99)).toBe(4999);
    expect(poundsToMinor(0.1 + 0.2)).toBe(30);
    expect(poundsToMinor(1025)).toBe(102500);
  });
  it("returns 0 for non-finite input", () => {
    expect(poundsToMinor(NaN)).toBe(0);
    expect(poundsToMinor("12")).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats GBP with pence", () => {
    expect(formatMoney(1234, "GBP")).toBe("£12.34");
    expect(formatMoney(-500, "GBP")).toBe("-£5.00");
    expect(formatMoney(0, "GBP")).toBe("£0.00");
  });
  it("formats whole amounts short", () => {
    expect(formatMoneyShort(120000, "GBP")).toBe("£1,200");
    expect(formatMoneyShort(120050, "GBP")).toBe("£1,200.50");
  });
  it("falls back to GBP for unknown codes", () => {
    expect(formatMoney(100, "XXX")).toBe("£1.00");
  });
});

describe("formatPercent", () => {
  it("rounds ratios", () => {
    expect(formatPercent(0.723)).toBe("72%");
    expect(formatPercent(1.5)).toBe("150%");
    expect(formatPercent(NaN)).toBe("0%");
  });
});
