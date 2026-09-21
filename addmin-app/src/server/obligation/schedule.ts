import type { PrismaClient } from "@prisma/client";

// Build Step 06 (planmysaas-blueprint/08-build-playbook.md): shared by every
// module that owns a recurring obligation (utility here; Lease/AMC/Compliance
// reuse this exact engine in Build Step 08 -- scope_type is a real
// discriminator, not something to special-case per caller).

export type ObligationScopeType = "utility" | "rent" | "cam" | "amc" | "compliance";
export type ObligationFrequency = "monthly" | "bimonthly" | "quarterly" | "annual";

type ScheduleEntities = {
  RecurringObligationSchedule: PrismaClient["recurringObligationSchedule"];
};

export async function createObligationSchedule(
  entities: ScheduleEntities,
  input: {
    org_id: string;
    scope_type: ObligationScopeType;
    scope_ref_id: string;
    frequency: ObligationFrequency;
    expected_window_days: number;
    due_rule: string;
    owner_user_id: string;
    active_from: Date;
  },
) {
  return entities.RecurringObligationSchedule.create({ data: input });
}

/** Stops future instance generation without touching historical ObligationInstance rows (F-07). */
export async function deactivateObligationSchedule(
  entities: ScheduleEntities,
  scope_type: ObligationScopeType,
  scope_ref_id: string,
): Promise<void> {
  await entities.RecurringObligationSchedule.updateMany({
    where: { scope_type, scope_ref_id, active_to: null },
    data: { active_to: new Date() },
  });
}

const FREQUENCY_STEP_MONTHS: Record<ObligationFrequency, number> = {
  monthly: 1,
  bimonthly: 2,
  quarterly: 3,
  annual: 12,
};

export type Period = {
  /** Natural key generationJob.ts dedupes on, e.g. "2026-09" or (quarterly) "2026-Q3". */
  key: string;
  start: Date;
  /**
   * Last day of the period. due_rule (schema.prisma) is free-text, not a
   * structured day-of-month rule, so this step uses period-end as
   * expected_date -- a reasonable default 04-architecture.md doesn't
   * contradict, revisit if a real due_rule parser is ever built.
   */
  end: Date;
};

function utcDateOnly(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addUtcMonths(date: Date, months: number): Date {
  const d = utcDateOnly(date);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** The billing period containing `asOf`, anchored on `activeFrom` (not calendar month). */
export function currentPeriod(activeFrom: Date, frequency: ObligationFrequency, asOf: Date): Period {
  const stepMonths = FREQUENCY_STEP_MONTHS[frequency];
  const anchor = utcDateOnly(activeFrom);
  let start = anchor;
  let next = addUtcMonths(start, stepMonths);
  while (next.getTime() <= asOf.getTime()) {
    start = next;
    next = addUtcMonths(start, stepMonths);
  }
  const end = new Date(next.getTime() - 24 * 60 * 60 * 1000); // day before next period starts
  return { key: periodKey(start, frequency), start, end };
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The billing period whose generation window includes `asOf`: from
 * (period.end - expectedWindowDays) through (period.end + expectedWindowDays).
 * Walks forward from `activeFrom` so a catch-up run still creates the latest
 * eligible period when an earlier cron was missed.
 */
export function obligationPeriodToGenerate(
  activeFrom: Date,
  frequency: ObligationFrequency,
  asOf: Date,
  expectedWindowDays: number,
): Period | null {
  const stepMonths = FREQUENCY_STEP_MONTHS[frequency];
  let start = utcDateOnly(activeFrom);
  let eligible: Period | null = null;

  for (let i = 0; i < 240; i++) {
    const next = addUtcMonths(start, stepMonths);
    const end = new Date(next.getTime() - MS_PER_DAY);
    const period: Period = { key: periodKey(start, frequency), start, end };
    const generateFrom = new Date(end.getTime() - expectedWindowDays * MS_PER_DAY);

    if (asOf.getTime() < generateFrom.getTime()) break;

    eligible = period;
    start = next;
  }

  return eligible;
}

function periodKey(periodStart: Date, frequency: ObligationFrequency): string {
  const year = periodStart.getUTCFullYear();
  const month = periodStart.getUTCMonth(); // 0-indexed
  if (frequency === "quarterly") return `${year}-Q${Math.floor(month / 3) + 1}`;
  if (frequency === "annual") return `${year}`;
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}
