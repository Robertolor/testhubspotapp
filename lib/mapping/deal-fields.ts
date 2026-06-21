import type { MindbodyFieldRef } from "@/lib/mapping/validate";

/** Static Mindbody deal fields until sale/contract catalog APIs (step 6.1). */
export const DEAL_MINDBODY_FIELDS: MindbodyFieldRef[] = [
  { key: "contractName", type: "string" },
  { key: "amount", type: "number" },
  { key: "contractStartDateTime", type: "datetime" },
  { key: "deal_source", type: "string" },
  { key: "saleId", type: "string" },
  { key: "clientContractId", type: "string" },
];

export const DEAL_MINDBODY_FIELD_LABELS: Record<string, string> = {
  contractName: "Contract name",
  amount: "Amount",
  contractStartDateTime: "Contract start",
  deal_source: "Deal source",
  saleId: "Sale ID",
  clientContractId: "Contract ID",
};
