import type { EntityType } from "@/lib/db/types";

export function parseMappingEntity(value: string | null): EntityType | null {
  if (value === "contact" || value === "deal") return value;
  return null;
}

export interface FieldMappingItem {
  id: string;
  hubspotProperty: string;
  mindbodyField: string;
  isCustom: boolean;
}

export function toFieldMappingItem(row: {
  id: string;
  hubspot_property: string;
  mindbody_field: string;
  is_custom: boolean;
}): FieldMappingItem {
  return {
    id: row.id,
    hubspotProperty: row.hubspot_property,
    mindbodyField: row.mindbody_field,
    isCustom: row.is_custom,
  };
}
