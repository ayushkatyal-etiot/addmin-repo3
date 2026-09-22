# Runbook: A scheduled job silently failed or didn't run

**Symptom:** reminders/escalations that should have fired didn't (no `NotificationLog` rows, no escalated leases/compliance items, obligation instances stuck without a new period generated), and no one noticed until a customer asked "why didn't I get reminded?"

## Jobs in this app (all PgBoss, all cron, `main.wasp.ts`)

| Job | Schedule | Reads config from |
|---|---|---|
| `trialExpiryJob` | before 03:00 | — |
| `obligationGenerationJob` | 03:00 nightly | `RecurringObligationSchedule` |
| `missingAlertJob` | 03:30 nightly | `NotificationRule` (`asset_warranty_expiry` etc. via their own jobs below) |
| `overdueBillsJob` | 04:00 nightly | — |
| `leaseRenewalReminderJob` / `leaseEscalationJob` | see `main.wasp.ts` | `NotificationRule` (`lease_renewal`) |
| `amcRenewalJob` | see `main.wasp.ts` | `NotificationRule` (`amc_renewal`) |
| `slaBreachEscalationJob` | see `main.wasp.ts` | — |
| `assetWarrantyReminderJob` | see `main.wasp.ts` | `NotificationRule` (`asset_warranty_expiry`) |
| `complianceExpiryJob` | see `main.wasp.ts` | `NotificationRule` (`compliance_expiry`) |

Jobs are deliberately chained by time (generation before missing-alert before overdue-bills) because each reads state the previous one produces — if you're re-running one manually, check whether an upstream job also needs a re-run first.

## 1. Confirm the job actually ran

PgBoss keeps its own job/schedule tables in Postgres (`pgboss.job`, `pgboss.schedule` by default). Check the most recent run:

```sql
select name, state, started_on, completed_on, output
from pgboss.job
where name = '<jobName>'
order by started_on desc
limit 5;
```

- `state = 'failed'` with an `output` payload → the job threw. Read the error in `output`, it's whatever the job function threw.
- No row for the expected time at all → PgBoss's scheduler itself may not have registered the cron, or the server process wasn't running at that time (PgBoss schedules run against wall-clock time, not "N minutes after server start").
- `state = 'completed'` but nothing changed → the job ran but its own logic decided there was nothing to do this run (e.g. no lease within a reminder window today) — this usually isn't a bug, verify against real data before assuming otherwise.

## 2. Common causes

1. **A `NotificationRule` reminder window doesn't match the case someone expected.** These jobs only fire reminders on the exact day counts configured (e.g. `[180, 90, 60, 30]` for `lease_renewal`) — check via `/admin/notifications` (Build Step 11) what's actually configured for the org in question, not what you assume the default is.
2. **The server process was down at the scheduled cron time.** PgBoss needs a running server to fire scheduled jobs — if the server restarted or was down at 03:00–04:00, that night's run is simply missed (PgBoss does not "catch up" a missed cron tick by default).
3. **A DB constraint or bad row blocks the whole batch.** Every job in this app loops over rows individually inside a `for`, but an unexpected error mid-loop (e.g. a null field the code didn't defend against) can still throw and abort the rest of that run — check the `output` error for which row/id it choked on.

## 3. Recovery

- To re-run a job on demand against real data (without waiting for the next cron tick), use the dev-only seed pattern already in `src/server/seed.ts`'s `runObligationJobs` — add a similar temporary `DbSeedFn` that imports the job function and calls it with `context.entities` mapped to the right Prisma delegates, run via `wasp db seed <name>`, then remove it. This is the same mechanism used to verify every Step 08 job during development.
- In production, prefer re-triggering via whatever your PgBoss/Wasp deployment exposes for manual job runs over hand-editing `pgboss.job` rows directly.

## 4. Prevention

- Wire job failures into the Sentry integration (`SENTRY_DSN`, `src/server/monitoring/sentry.ts`) — every job function's uncaught throw should already surface there once Sentry is configured for the environment; if it isn't showing up, check the job is wrapped the same way `paymentsWebhook` and API routes are.
- The three-nightly-job chain being time-based (03:00/03:30/04:00) instead of dependency-based is a known simplification — if this keeps causing missed downstream runs after an upstream delay, that's the point to revisit (e.g. chain them explicitly instead of by clock time).
