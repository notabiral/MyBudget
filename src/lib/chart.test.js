import { describe, expect, it } from "vitest";
import { axisMax, axisTicks, niceCeiling } from "./chart.js";

describe("niceCeiling", () => {
  it("returns 0 for non-positive input", () => {
    expect(niceCeiling(0)).toBe(0);
    expect(niceCeiling(-5)).toBe(0);
  });

  it("rounds up to the 1/2/2.5/5/10 ladder", () => {
    expect(niceCeiling(1)).toBe(1);
    expect(niceCeiling(334800)).toBe(500000);
    expect(niceCeiling(100000)).toBe(100000);
    expect(niceCeiling(250000)).toBe(250000);
    expect(niceCeiling(250001)).toBe(500000);
    expect(niceCeiling(999)).toBe(1000);
    expect(niceCeiling(1000)).toBe(1000);
    expect(niceCeiling(210000)).toBe(250000);
  });
});

describe("axisMax", () => {
  it("floors at £1 so tiny windows keep distinct labels", () => {
    expect(axisMax(0)).toBe(100);
    expect(axisMax(1)).toBe(100);
    expect(axisMax(50)).toBe(100);
  });

  it("uses the nice ceiling above the floor", () => {
    expect(axisMax(334800)).toBe(500000);
    expect(axisMax(100000)).toBe(100000);
  });
});

describe("axisTicks", () => {
  it("returns 0, half and full for a real window", () => {
    expect(axisTicks(334800)).toEqual([0, 250000, 500000]);
  });

  it("stays distinct and covers the data for an empty window", () => {
    expect(axisTicks(0)).toEqual([0, 50, 100]);
  });

  it("is strictly increasing and covers the largest value", () => {
    for (const v of [0, 1, 37, 100, 999, 12345, 334800, 999999, 2500000]) {
      const [lo, mid, hi] = axisTicks(v);
      expect(lo).toBe(0);
      expect(mid).toBeGreaterThan(lo);
      expect(hi).toBeGreaterThan(mid);
      expect(hi).toBeGreaterThanOrEqual(v);
    }
  });
});
