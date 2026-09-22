import { describe, expect, it } from "vitest";
import { amcRenewalPeriodKey } from "../src/server/vendor/amcObligation";

describe("amcRenewalPeriodKey", () => {
  it("is stable per contract end date", () => {
    const end = new Date("2026-09-30T00:00:00.000Z");
    expect(amcRenewalPeriodKey("1154487c-4322-4648-a075-04266c7855ae", end)).toBe(
      "amc-1154487c-2026-09-30",
    );
  });
});
