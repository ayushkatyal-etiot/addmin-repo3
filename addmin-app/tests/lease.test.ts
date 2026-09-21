import { describe, it, expect } from "vitest";
import { HttpError } from "wasp/server";
import { calculateTds } from "../src/server/property/rentPayment";
import { daysBetween } from "../src/server/property/leaseJobs";

// Build Step 08, F-13: TDS calculation is the one money-path piece of the
// Lease domain worth a standalone unit test, per authz.test.ts's precedent
// (unit-level, no live DB).
describe("calculateTds", () => {
  it("computes TDS and net amount at the configured rate", () => {
    expect(calculateTds(50000, 10)).toEqual({ tdsAmount: 5000, netAmount: 45000 });
  });
  const cases: Array<[number, number, number, number]> = [
    [10000, 10, 1000, 9000],
    [12345.67, 7.5, 925.93, 11419.74],
    [1, 33.33, 0.33, 0.67],
    [999999, 20, 199999.8, 799999.2],
    [50, 2, 1, 49],
  ];

  for (const [gross, rate, expectedTds, expectedNet] of cases) {
    it(`gross ${gross} @ ${rate}% -> tds ${expectedTds}, net ${expectedNet}`, () => {
      const { tdsAmount, netAmount } = calculateTds(gross, rate);
      expect(tdsAmount).toBeCloseTo(expectedTds, 2);
      expect(netAmount).toBeCloseTo(expectedNet, 2);
    });
  }

  it("blocks with a clear error when no rate is configured, never a silent zero-TDS payment", () => {
    expect(() => calculateTds(50000, null)).toThrow(HttpError);
    expect(() => calculateTds(50000, null)).toThrow(/no TDS rate is configured/);
  });
});

describe("daysBetween (lease renewal reminder windows)", () => {
  it("counts whole days from today to a future end date", () => {
    const today = new Date("2026-09-21T00:00:00Z");
    const in30 = new Date("2026-10-21T00:00:00Z");
    expect(daysBetween(in30, today)).toBe(30);
  });

  it("matches each of the 180/90/60/30 default reminder windows", () => {
    const today = new Date("2026-01-01T00:00:00Z");
    for (const days of [180, 90, 60, 30]) {
      const end = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);
      expect(daysBetween(end, today)).toBe(days);
    }
  });
});
