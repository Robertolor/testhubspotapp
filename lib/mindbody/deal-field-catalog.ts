export type MindbodyDealSource = "sale" | "contract";

export type MindbodyDealCatalogEntity = "sale" | "contract";

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
  if (value === "sale" || value === "contract") return value;
  return null;
}

export function listMindbodySaleFields(): MindbodyDealFieldCatalogItem[] {
  return sortDealFields(SALE_FIELDS);
}

export function listMindbodyContractFields(): MindbodyDealFieldCatalogItem[] {
  return sortDealFields(CONTRACT_FIELDS);
}

export function listMindbodyDealFieldsForSource(
  source: MindbodyDealSource
): MindbodyDealFieldCatalogItem[] {
  return source === "sale" ? listMindbodySaleFields() : listMindbodyContractFields();
}

export function inferDealMindbodySource(fieldKey: string): MindbodyDealSource | null {
  if (SALE_FIELDS.some((field) => field.key === fieldKey)) return "sale";
  if (CONTRACT_FIELDS.some((field) => field.key === fieldKey)) return "contract";
  return null;
}
