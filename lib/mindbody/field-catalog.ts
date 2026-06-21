import type { MindbodyAccount } from "@/lib/db/types";
import { listMindbodyCustomClientFieldDefinitions } from "@/lib/mindbody/client";

export type MindbodyCatalogEntity = "contact";

export interface MindbodyFieldCatalogItem {
  key: string;
  label: string;
  type: string;
  groupName: "standard" | "nested" | "custom";
  isCustom: boolean;
}

type CatalogFieldDef = Omit<MindbodyFieldCatalogItem, "isCustom">;

const STANDARD_CONTACT_FIELDS: CatalogFieldDef[] = [
  { key: "Id", label: "Client ID", type: "string", groupName: "standard" },
  { key: "UniqueId", label: "Unique ID", type: "number", groupName: "standard" },
  { key: "Email", label: "Email", type: "string", groupName: "standard" },
  { key: "FirstName", label: "First name", type: "string", groupName: "standard" },
  { key: "MiddleName", label: "Middle name", type: "string", groupName: "standard" },
  { key: "LastName", label: "Last name", type: "string", groupName: "standard" },
  { key: "MobilePhone", label: "Mobile phone", type: "string", groupName: "standard" },
  { key: "HomePhone", label: "Home phone", type: "string", groupName: "standard" },
  { key: "WorkPhone", label: "Work phone", type: "string", groupName: "standard" },
  { key: "WorkExtension", label: "Work extension", type: "string", groupName: "standard" },
  { key: "AddressLine1", label: "Address line 1", type: "string", groupName: "standard" },
  { key: "AddressLine2", label: "Address line 2", type: "string", groupName: "standard" },
  { key: "City", label: "City", type: "string", groupName: "standard" },
  { key: "State", label: "State", type: "string", groupName: "standard" },
  { key: "PostalCode", label: "Postal code", type: "string", groupName: "standard" },
  { key: "Country", label: "Country", type: "string", groupName: "standard" },
  { key: "BirthDate", label: "Birth date", type: "datetime", groupName: "standard" },
  { key: "Gender", label: "Gender", type: "string", groupName: "standard" },
  { key: "CreationDate", label: "Creation date", type: "datetime", groupName: "standard" },
  { key: "LastModifiedDateTime", label: "Last modified", type: "datetime", groupName: "standard" },
  { key: "FirstAppointmentDate", label: "First appointment date", type: "datetime", groupName: "standard" },
  { key: "IsProspect", label: "Is prospect", type: "boolean", groupName: "standard" },
  { key: "IsCompany", label: "Is company", type: "boolean", groupName: "standard" },
  { key: "Active", label: "Active", type: "boolean", groupName: "standard" },
  { key: "Status", label: "Status", type: "string", groupName: "standard" },
  { key: "Notes", label: "Notes", type: "string", groupName: "standard" },
  { key: "ReferredBy", label: "Referred by", type: "string", groupName: "standard" },
  { key: "AccountBalance", label: "Account balance", type: "number", groupName: "standard" },
  { key: "EmergencyContactInfoName", label: "Emergency contact name", type: "string", groupName: "standard" },
  { key: "EmergencyContactInfoEmail", label: "Emergency contact email", type: "string", groupName: "standard" },
  { key: "EmergencyContactInfoPhone", label: "Emergency contact phone", type: "string", groupName: "standard" },
  {
    key: "EmergencyContactInfoRelationship",
    label: "Emergency contact relationship",
    type: "string",
    groupName: "standard",
  },
];

const NESTED_CONTACT_FIELDS: CatalogFieldDef[] = [
  { key: "HomeLocation.Id", label: "Home location ID", type: "number", groupName: "nested" },
  { key: "HomeLocation.Name", label: "Home location name", type: "string", groupName: "nested" },
  { key: "HomeLocation.SiteID", label: "Home location site ID", type: "number", groupName: "nested" },
];

const PRIORITY_KEYS = new Set([
  "Id",
  "Email",
  "FirstName",
  "LastName",
  "MobilePhone",
  "HomePhone",
]);

const GROUP_ORDER: Record<MindbodyFieldCatalogItem["groupName"], number> = {
  standard: 0,
  nested: 1,
  custom: 2,
};

export function parseMindbodyCatalogEntity(
  value: string | null
): MindbodyCatalogEntity | null {
  if (value === "contact") return "contact";
  return null;
}

function normalizeMindbodyDataType(dataType?: string): string {
  const normalized = (dataType ?? "").trim().toLowerCase();
  if (!normalized) return "string";
  if (normalized.includes("bool")) return "boolean";
  if (normalized.includes("date") || normalized.includes("time")) return "datetime";
  if (
    normalized.includes("double") ||
    normalized.includes("float") ||
    normalized.includes("int") ||
    normalized.includes("number") ||
    normalized.includes("decimal")
  ) {
    return "number";
  }
  return "string";
}

function sortCatalogItems(
  items: MindbodyFieldCatalogItem[]
): MindbodyFieldCatalogItem[] {
  return [...items].sort((a, b) => {
    const groupDiff = GROUP_ORDER[a.groupName] - GROUP_ORDER[b.groupName];
    if (groupDiff !== 0) return groupDiff;

    const aPriority = PRIORITY_KEYS.has(a.key) ? 0 : 1;
    const bPriority = PRIORITY_KEYS.has(b.key) ? 0 : 1;
    if (aPriority !== bPriority) return aPriority - bPriority;

    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}

export async function listMindbodyContactFields(
  account: MindbodyAccount
): Promise<MindbodyFieldCatalogItem[]> {
  const customDefs = await listMindbodyCustomClientFieldDefinitions(account);

  const items: MindbodyFieldCatalogItem[] = [
    ...STANDARD_CONTACT_FIELDS.map((field) => ({ ...field, isCustom: false })),
    ...NESTED_CONTACT_FIELDS.map((field) => ({ ...field, isCustom: false })),
    ...customDefs.map((field) => ({
      key: `custom:${field.Id}`,
      label: field.Name?.trim() || `Custom field ${field.Id}`,
      type: normalizeMindbodyDataType(field.DataType),
      groupName: "custom" as const,
      isCustom: true,
    })),
  ];

  return sortCatalogItems(items);
}
