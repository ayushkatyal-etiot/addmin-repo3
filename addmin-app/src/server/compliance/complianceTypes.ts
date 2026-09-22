// F-17: "Organization can add custom certificate types beyond the seeded
// list" -- ComplianceItem.compliance_type is free text (schema.prisma), so
// a custom type just means a row whose type isn't in this list; nothing
// else in the module special-cases seeded vs. custom. This mirrors
// onboarding/checklistTemplates.ts's compliance category codes.
export const SEEDED_COMPLIANCE_TYPES = [
  "fire_noc",
  "trade_license",
  "shops_establishment",
  "pollution_control",
] as const;
