import { z } from "zod";

// Prisma's Json type doesn't validate shape at the schema level -- these are
// the application-level schemas for the two `Json` columns in schema.prisma.

export const bankDetailsSchema = z.object({
  account_holder_name: z.string(),
  account_number: z.string(),
  ifsc_code: z.string(),
  bank_name: z.string(),
});
export type BankDetails = z.infer<typeof bankDetailsSchema>;

// Per-office role/permission overrides for a User whose access isn't
// uniform across every office in their org (04-architecture.md: User.office_scope).
export const officeScopeSchema = z.record(z.string(), z.array(z.string()));
export type OfficeScope = z.infer<typeof officeScopeSchema>;
