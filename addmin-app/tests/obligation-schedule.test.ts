import { describe, expect, it } from "vitest";
import { currentPeriod, obligationPeriodToGenerate } from "../src/server/obligation/schedule";
import { normalizeBillingPeriodKey } from "../src/server/obligation/instanceLifecycle";

describe("currentPeriod", () => {
  it("anchors monthly periods on active_from, not calendar month start", () => {
    const activeFrom = new Date("2026-08-20T00:00:00.000Z");
    const asOf = new Date("2026-09-21T12:00:00.000Z");

    const period = currentPeriod(activeFrom, "monthly", asOf);

    expect(period.key).toBe("2026-09");
    expect(period.start.toISOString().slice(0, 10)).toBe("2026-09-20");
    expect(period.end.toISOString().slice(0, 10)).toBe("2026-10-19");
  });

  it("returns the first period when asOf is still inside it", () => {
    const activeFrom = new Date("2026-08-20T00:00:00.000Z");
    const asOf = new Date("2026-09-15T12:00:00.000Z");

    const period = currentPeriod(activeFrom, "monthly", asOf);

    expect(period.start.toISOString().slice(0, 10)).toBe("2026-08-20");
    expect(period.end.toISOString().slice(0, 10)).toBe("2026-09-19");
  });
});

describe("obligationPeriodToGenerate", () => {
  const activeFrom = new Date("2026-08-20T00:00:00.000Z");
  const windowDays = 7;

  it("selects the first anchored period while its window is open (expected by 26 Sep)", () => {
    const asOf = new Date("2026-09-21T12:00:00.000Z");
    const period = obligationPeriodToGenerate(activeFrom, "monthly", asOf, windowDays);

    expect(period?.start.toISOString().slice(0, 10)).toBe("2026-08-20");
    expect(period?.end.toISOString().slice(0, 10)).toBe("2026-09-19");

    const expectedBy = new Date(period!.end.getTime() + windowDays * 86400000);
    expect(expectedBy.toISOString().slice(0, 10)).toBe("2026-09-26");
  });

  it("returns null before the first generation window opens", () => {
    const asOf = new Date("2026-09-10T12:00:00.000Z");
    expect(obligationPeriodToGenerate(activeFrom, "monthly", asOf, windowDays)).toBeNull();
  });
});

describe("normalizeBillingPeriodKey", () => {
  it("zero-pads month segments so they match obligation instance period keys", () => {
    expect(normalizeBillingPeriodKey("2026-9")).toBe("2026-09");
    expect(normalizeBillingPeriodKey(" 2026-09 ")).toBe("2026-09");
  });
});
