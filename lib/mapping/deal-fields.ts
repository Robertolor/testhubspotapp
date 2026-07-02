import type { MindbodyFieldRef } from "@/lib/mapping/validate";
import {
  listMindbodyContractFields,
  listMindbodySaleFields,
  type MindbodyDealSource,
} from "@/lib/mindbody/deal-field-catalog";

export type { MindbodyDealSource };

export function dealMindbodyFieldsForSource(
  source: MindbodyDealSource
): MindbodyFieldRef[] {
  const list =
    source === "sale" ? listMindbodySaleFields() : listMindbodyContractFields();
  return list.map((field) => ({ key: field.key, type: field.type }));
}

/** @deprecated Use dealMindbodyFieldsForSource — kept for imports during transition */
export const DEAL_MINDBODY_FIELDS = dealMindbodyFieldsForSource("contract");

export const DEAL_MINDBODY_FIELD_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    listMindbodySaleFields().map((field) => [field.key, field.label])
  ),
  ...Object.fromEntries(
    listMindbodyContractFields().map((field) => [field.key, field.label])
  ),
};
