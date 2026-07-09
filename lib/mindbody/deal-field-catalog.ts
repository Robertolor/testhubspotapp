import type { MindbodyMappingSource } from "@/lib/db/types";

export type MindbodyDealSource = MindbodyMappingSource;

export type MindbodyDealCatalogEntity =
  | "sale"
  | "contract"
  | "appointment"
  | "visit";

export interface MindbodyDealFieldCatalogItem {
  key: string;
  label: string;
  type: string;
  source: MindbodyDealSource;
}

type DealFieldDef = MindbodyDealFieldCatalogItem;

const SALE_FIELDS: DealFieldDef[] = [
  { key: "saleId", label: "Sale ID", type: "string", source: "sale" },
  { key: "clientId", label: "Client ID", type: "string", source: "sale" },
  { key: "clientUniqueId", label: "Client unique ID", type: "string", source: "sale" },
  { key: "totalAmount", label: "Total amount", type: "number", source: "sale" },
  { key: "paymentsTotal", label: "Payments total", type: "number", source: "sale" },
  { key: "amount", label: "Amount", type: "number", source: "sale" },
  { key: "saleDateTime", label: "Sale date", type: "datetime", source: "sale" },
  { key: "originalSaleDateTime", label: "Original sale date", type: "datetime", source: "sale" },
];

const CONTRACT_FIELDS: DealFieldDef[] = [
  {
    key: "clientContractId",
    label: "Contract ID",
    type: "string",
    source: "contract",
  },
  {
    key: "clientUniqueId",
    label: "Client unique ID",
    type: "string",
    source: "contract",
  },
  { key: "contractName", label: "Contract name", type: "string", source: "contract" },
  {
    key: "contractStartDateTime",
    label: "Contract start",
    type: "datetime",
    source: "contract",
  },
  {
    key: "contractEndDateTime",
    label: "Contract end",
    type: "datetime",
    source: "contract",
  },
  { key: "agreementDate", label: "Agreement date", type: "datetime", source: "contract" },
  { key: "autopayStatus", label: "Autopay status", type: "string", source: "contract" },
  { key: "locationId", label: "Location ID", type: "number", source: "contract" },
];

const APPOINTMENT_FIELDS: DealFieldDef[] = [
  { key: "mindbody_appointment_id", label: "Appointment ID", type: "string", source: "appointment" },
  { key: "record_key", label: "Record key", type: "string", source: "appointment" },
  { key: "source_client_reference", label: "Source client reference", type: "string", source: "appointment" },
  { key: "resolved_contact_client_id", label: "Resolved contact client ID", type: "string", source: "appointment" },
  { key: "status_raw", label: "Status", type: "string", source: "appointment" },
  { key: "derived_stage", label: "Derived stage", type: "string", source: "appointment" },
  { key: "start_datetime", label: "Start date/time", type: "datetime", source: "appointment" },
  { key: "end_datetime", label: "End date/time", type: "datetime", source: "appointment" },
  { key: "session_type_id", label: "Session type ID", type: "string", source: "appointment" },
  { key: "appointment_name", label: "Appointment name", type: "string", source: "appointment" },
  { key: "staff_id", label: "Staff ID", type: "string", source: "appointment" },
  { key: "staff_name", label: "Staff name", type: "string", source: "appointment" },
  { key: "resource_ids", label: "Resource IDs", type: "string", source: "appointment" },
  { key: "resource_names", label: "Resource names", type: "string", source: "appointment" },
  { key: "deal_name", label: "Deal name", type: "string", source: "appointment" },
];

const VISIT_FIELDS: DealFieldDef[] = [
  { key: "mindbody_visit_id", label: "Visit ID", type: "string", source: "visit" },
  { key: "record_key", label: "Record key", type: "string", source: "visit" },
  { key: "source_client_id", label: "Source client ID", type: "string", source: "visit" },
  { key: "start_datetime", label: "Start date/time", type: "datetime", source: "visit" },
  { key: "end_datetime", label: "End date/time", type: "datetime", source: "visit" },
  { key: "visit_name", label: "Visit name", type: "string", source: "visit" },
  { key: "service_name", label: "Service name", type: "string", source: "visit" },
  { key: "status_raw", label: "Status", type: "string", source: "visit" },
  { key: "derived_stage", label: "Derived stage", type: "string", source: "visit" },
  { key: "program_id", label: "Program ID", type: "string", source: "visit" },
  { key: "program_name", label: "Program name", type: "string", source: "visit" },
  { key: "schedule_type", label: "Schedule type", type: "string", source: "visit" },
  { key: "staff_id", label: "Staff ID", type: "string", source: "visit" },
  { key: "staff_name", label: "Staff name", type: "string", source: "visit" },
  { key: "deal_name", label: "Deal name", type: "string", source: "visit" },
];

const SALE_PRIORITY = new Set(["saleId", "totalAmount", "clientId"]);
const CONTRACT_PRIORITY = new Set([
  "clientContractId",
  "contractName",
  "contractStartDateTime",
]);

function sortDealFields(items: MindbodyDealFieldCatalogItem[]): MindbodyDealFieldCatalogItem[] {
  const priority =
    items[0]?.source === "sale" ? SALE_PRIORITY : CONTRACT_PRIORITY;
  return [...items].sort((a, b) => {
    const aPriority = priority.has(a.key) ? 0 : 1;
    const bPriority = priority.has(b.key) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}

export function parseMindbodyDealCatalogEntity(
  value: string | null
): MindbodyDealCatalogEntity | null {
  if (
    value === "sale" ||
    value === "contract" ||
    value === "appointment" ||
    value === "visit"
  ) {
    return value;
  }
  return null;
}

export function listMindbodySaleFields(): MindbodyDealFieldCatalogItem[] {
  return sortDealFields(SALE_FIELDS);
}

export function listMindbodyContractFields(): MindbodyDealFieldCatalogItem[] {
  return sortDealFields(CONTRACT_FIELDS);
}

export function listMindbodyAppointmentFields(): MindbodyDealFieldCatalogItem[] {
  return sortDealFields(APPOINTMENT_FIELDS);
}

export function listMindbodyVisitFields(): MindbodyDealFieldCatalogItem[] {
  return sortDealFields(VISIT_FIELDS);
}

export function listMindbodyDealFieldsForSource(
  source: MindbodyDealSource
): MindbodyDealFieldCatalogItem[] {
  switch (source) {
    case "sale":
      return listMindbodySaleFields();
    case "contract":
      return listMindbodyContractFields();
    case "appointment":
      return listMindbodyAppointmentFields();
    case "visit":
      return listMindbodyVisitFields();
  }
}

export function inferDealMindbodySource(fieldKey: string): MindbodyDealSource | null {
  if (SALE_FIELDS.some((field) => field.key === fieldKey)) return "sale";
  if (CONTRACT_FIELDS.some((field) => field.key === fieldKey)) return "contract";
  if (APPOINTMENT_FIELDS.some((field) => field.key === fieldKey)) return "appointment";
  if (VISIT_FIELDS.some((field) => field.key === fieldKey)) return "visit";
  return null;
}
