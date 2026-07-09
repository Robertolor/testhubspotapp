import type { EntityType, MindbodyMappingSource } from "@/lib/db/types";

export function parseMappingEntity(value: string | null): EntityType | null {
  if (value === "contact" || value === "deal" || value === "line_item") {
    return value;
  }
  return null;
}

export function parseMindbodyMappingSource(
  value: string | null | undefined
): MindbodyMappingSource | null {
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

/** @deprecated Use parseMindbodyMappingSource */
export function parseMindbodyDealSource(
  value: string | null | undefined
): MindbodyMappingSource | null {
  return parseMindbodyMappingSource(value);
}

export interface FieldMappingItem {
  id: string;
  hubspotProperty: string;
  mindbodyField: string;
  isCustom: boolean;
  isSystem: boolean;
  hubspotPropertyType: string | null;
  mindbodyFieldType: string | null;
  mindbodySource: MindbodyMappingSource | null;
}

export function toFieldMappingItem(row: {
  id: string;
  hubspot_property: string;
  mindbody_field: string;
  is_custom: boolean;
  is_system: boolean;
  hubspot_property_type: string | null;
  mindbody_field_type: string | null;
  mindbody_source?: MindbodyMappingSource | null;
}): FieldMappingItem {
  return {
    id: row.id,
    hubspotProperty: row.hubspot_property,
    mindbodyField: row.mindbody_field,
    isCustom: row.is_custom,
    isSystem: row.is_system,
    hubspotPropertyType: row.hubspot_property_type,
    mindbodyFieldType: row.mindbody_field_type,
    mindbodySource: row.mindbody_source ?? null,
  };
}
