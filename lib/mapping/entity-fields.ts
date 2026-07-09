import type { MindbodyFieldRef } from "@/lib/mapping/validate";
import type { EntityType, MindbodyMappingSource } from "@/lib/db/types";
import {
  listMindbodyAppointmentFields,
  listMindbodyContractFields,
  listMindbodySaleFields,
  listMindbodyVisitFields,
} from "@/lib/mindbody/deal-field-catalog";
import { listMindbodyLineItemFields } from "@/lib/mindbody/line-item-field-catalog";

export type { MindbodyMappingSource };

export function mindbodyFieldsForMapping(
  entity: EntityType,
  source?: MindbodyMappingSource
): MindbodyFieldRef[] {
  if (entity === "line_item") {
    return listMindbodyLineItemFields().map((field) => ({
      key: field.key,
      type: field.type,
    }));
  }

  if (entity !== "deal" || !source) {
    throw new Error("Deal mappings require mindbodySource");
  }

  const list =
    source === "sale"
      ? listMindbodySaleFields()
      : source === "contract"
        ? listMindbodyContractFields()
        : source === "appointment"
          ? listMindbodyAppointmentFields()
          : listMindbodyVisitFields();

  return list.map((field) => ({ key: field.key, type: field.type }));
}

/** @deprecated Use mindbodyFieldsForMapping */
export function dealMindbodyFieldsForSource(
  source: MindbodyMappingSource
): MindbodyFieldRef[] {
  return mindbodyFieldsForMapping("deal", source);
}

export const DEAL_MINDBODY_FIELD_LABELS: Record<string, string> = {
  ...Object.fromEntries(
    listMindbodySaleFields().map((field) => [field.key, field.label])
  ),
  ...Object.fromEntries(
    listMindbodyContractFields().map((field) => [field.key, field.label])
  ),
  ...Object.fromEntries(
    listMindbodyAppointmentFields().map((field) => [field.key, field.label])
  ),
  ...Object.fromEntries(
    listMindbodyVisitFields().map((field) => [field.key, field.label])
  ),
  ...Object.fromEntries(
    listMindbodyLineItemFields().map((field) => [field.key, field.label])
  ),
};
