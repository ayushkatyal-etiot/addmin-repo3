// Build Step 04 (planmysaas-blueprint/08-build-playbook.md): the actual
// OfficeChecklistTemplate content the wizard walks every new office through.
// 04-architecture.md doesn't model OfficeChecklistTemplate as its own Prisma
// table -- OfficeChecklistItem.template_item_code is a plain string, so this
// is the single place that content lives (per the build playbook's file
// list: "seed/checklistTemplates.ts"). Kept in src/server/onboarding/ rather
// than a top-level seed/ folder since Wasp's server code all lives under
// src/server/.
//
// Content ownership: product/founder, per the build playbook's note --
// this list is a reasonable placeholder set covering F-04's six categories,
// not a final signed-off list. Edit freely without touching wizard logic.

export type ChecklistCategory =
  | "utility"
  | "facility"
  | "compliance"
  | "vendor"
  | "asset"
  | "role";

export interface ChecklistTemplateItem {
  code: string;
  category: ChecklistCategory;
  label: string;
  // Category-specific copy for the Yes/No/Not Applicable toggle -- compliance
  // items read as Available/Missing/Not Applicable in the UI even though the
  // underlying ChecklistApplicability enum values (yes/no/not_applicable)
  // are shared across every category (04-architecture.md doesn't add a
  // second enum for this, it's a presentation-only distinction).
  yesLabel: string;
  noLabel: string;
}

export const CHECKLIST_CATEGORY_ORDER: ChecklistCategory[] = [
  "utility",
  "facility",
  "compliance",
  "vendor",
  "asset",
  "role",
];

export const CHECKLIST_CATEGORY_TITLES: Record<ChecklistCategory, string> = {
  utility: "Utilities",
  facility: "Facilities",
  compliance: "Compliance",
  vendor: "Vendors",
  asset: "Assets",
  role: "Roles",
};

export const CHECKLIST_TEMPLATE: ChecklistTemplateItem[] = [
  // --- Utilities ---------------------------------------------------------
  { code: "utility_electricity", category: "utility", label: "Electricity", yesLabel: "Yes", noLabel: "No" },
  { code: "utility_water", category: "utility", label: "Water", yesLabel: "Yes", noLabel: "No" },
  { code: "utility_internet", category: "utility", label: "Internet", yesLabel: "Yes", noLabel: "No" },
  { code: "utility_telephone", category: "utility", label: "Telephone", yesLabel: "Yes", noLabel: "No" },
  { code: "utility_gas", category: "utility", label: "Gas", yesLabel: "Yes", noLabel: "No" },
  { code: "utility_dg", category: "utility", label: "DG (Diesel Generator)", yesLabel: "Yes", noLabel: "No" },
  { code: "utility_ups", category: "utility", label: "UPS", yesLabel: "Yes", noLabel: "No" },
  { code: "utility_solar", category: "utility", label: "Solar", yesLabel: "Yes", noLabel: "No" },

  // --- Facilities ----------------------------------------------------------
  { code: "facility_housekeeping", category: "facility", label: "Housekeeping", yesLabel: "Yes", noLabel: "No" },
  { code: "facility_security", category: "facility", label: "Security", yesLabel: "Yes", noLabel: "No" },
  { code: "facility_parking", category: "facility", label: "Parking", yesLabel: "Yes", noLabel: "No" },
  { code: "facility_pantry", category: "facility", label: "Pantry / Cafeteria", yesLabel: "Yes", noLabel: "No" },

  // --- Compliance ----------------------------------------------------------
  { code: "compliance_fire_noc", category: "compliance", label: "Fire NOC", yesLabel: "Available", noLabel: "Missing" },
  { code: "compliance_trade_license", category: "compliance", label: "Trade License", yesLabel: "Available", noLabel: "Missing" },
  { code: "compliance_shops_establishment", category: "compliance", label: "Shops & Establishment Registration", yesLabel: "Available", noLabel: "Missing" },
  { code: "compliance_pollution_control", category: "compliance", label: "Pollution Control Certificate", yesLabel: "Available", noLabel: "Missing" },

  // --- Vendors ---------------------------------------------------------------
  { code: "vendor_utility_mapping", category: "vendor", label: "Utility vendors mapped", yesLabel: "Yes", noLabel: "No" },
  { code: "vendor_facility_mapping", category: "vendor", label: "Facility vendors mapped", yesLabel: "Yes", noLabel: "No" },
  { code: "vendor_amc_mapping", category: "vendor", label: "AMC vendors mapped", yesLabel: "Yes", noLabel: "No" },

  // --- Assets ------------------------------------------------------------
  { code: "asset_register_setup", category: "asset", label: "Asset register set up", yesLabel: "Yes", noLabel: "No" },

  // --- Roles ------------------------------------------------------------
  { code: "role_office_admin", category: "role", label: "Office Admin assigned", yesLabel: "Yes", noLabel: "No" },
  { code: "role_checker", category: "role", label: "Checker assigned", yesLabel: "Yes", noLabel: "No" },
  { code: "role_payment_authorizer", category: "role", label: "Payment Authorizer assigned", yesLabel: "Yes", noLabel: "No" },
  { code: "role_compliance_coordinator", category: "role", label: "Compliance Coordinator assigned", yesLabel: "Yes", noLabel: "No" },
  { code: "role_vendor_manager", category: "role", label: "Vendor Manager assigned", yesLabel: "Yes", noLabel: "No" },
  { code: "role_facility_staff", category: "role", label: "Facility Staff assigned", yesLabel: "Yes", noLabel: "No" },
];
