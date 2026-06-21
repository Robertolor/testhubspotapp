import { getSupabase } from "@/lib/db/client";
import type { EntityType } from "@/lib/db/types";
import { DEAL_MINDBODY_FIELDS } from "@/lib/mapping/deal-fields";
import type { FieldMappingItem } from "@/lib/mapping/fields";
import { toFieldMappingItem } from "@/lib/mapping/fields";
import { listMindbodyContactFields } from "@/lib/mindbody/field-catalog";
import { getMindbodyAccountByTenant } from "@/lib/mindbody/client";
import {
  listHubspotProperties,
  type HubspotCatalogObject,
} from "@/lib/hubspot/property-catalog";
import {
  getHubspotAccountByTenant,
  getValidAccessToken,
} from "@/lib/hubspot/tokens";
import {
  SYSTEM_CONTACT_MAPPING_PAIRS,
  SYSTEM_DEAL_MAPPING_PAIRS,
  validateContactMappingSave,
  validateMappingBatch,
  validateSystemMappingsPreserved,
  type HubspotPropertyRef,
  type MappingRowRef,
  type MindbodyFieldRef,
} from "@/lib/mapping/validate";
import { getFieldMappings } from "@/lib/sync/field-mappings";

export interface SaveMappingInput {
  hubspotProperty: string;
  mindbodyField: string;
}

interface HubspotCatalogEntry extends HubspotPropertyRef {
  groupName: string;
}

function hubspotObjectForEntity(entity: EntityType): HubspotCatalogObject {
  return entity === "contact" ? "contacts" : "deals";
}

function systemPairsForEntity(entity: EntityType): MappingRowRef[] {
  return entity === "contact"
    ? SYSTEM_CONTACT_MAPPING_PAIRS
    : SYSTEM_DEAL_MAPPING_PAIRS;
}

function resolveIsSystem(
  entity: EntityType,
  hubspotProperty: string,
  existing: MappingRowRef[]
): boolean {
  const prev = existing.find((row) => row.hubspotProperty === hubspotProperty);
  if (prev?.isSystem) return true;
  return systemPairsForEntity(entity).some(
    (row) => row.hubspotProperty === hubspotProperty
  );
}

function isHubspotCustomProperty(
  hubspotProperty: string,
  groupName?: string
): boolean {
  return (
    hubspotProperty.startsWith("mindbody_") || groupName === "mindbody_sync"
  );
}

async function loadHubspotCatalog(
  tenantId: string,
  entity: EntityType
): Promise<HubspotCatalogEntry[]> {
  const hubspotAccount = await getHubspotAccountByTenant(tenantId);
  if (!hubspotAccount) {
    throw new Error("HubSpot is not connected for this tenant");
  }
  const accessToken = await getValidAccessToken(hubspotAccount);
  const properties = await listHubspotProperties(
    accessToken,
    hubspotObjectForEntity(entity)
  );
  return properties.map((prop) => ({
    name: prop.name,
    type: prop.type,
    readOnly: prop.readOnly,
    groupName: prop.groupName,
  }));
}

async function loadMindbodyCatalog(
  tenantId: string,
  entity: EntityType
): Promise<MindbodyFieldRef[]> {
  if (entity === "deal") {
    return DEAL_MINDBODY_FIELDS;
  }

  const mindbodyAccount = await getMindbodyAccountByTenant(tenantId);
  if (!mindbodyAccount?.api_key_encrypted) {
    throw new Error("Mindbody is not configured for this tenant");
  }

  const fields = await listMindbodyContactFields(mindbodyAccount);
  return fields.map((field) => ({ key: field.key, type: field.type }));
}

function mergeValidation(
  ...results: { ok: boolean; errors: string[]; warnings: string[] }[]
) {
  const errors = results.flatMap((r) => r.errors);
  const warnings = results.flatMap((r) => r.warnings);
  return { ok: errors.length === 0, errors, warnings };
}

export class SaveMappingsError extends Error {
  constructor(
    message: string,
    readonly errors: string[]
  ) {
    super(message);
    this.name = "SaveMappingsError";
  }
}

export async function saveEntityFieldMappings(
  tenantId: string,
  entity: EntityType,
  proposed: SaveMappingInput[]
): Promise<{ mappings: FieldMappingItem[]; warnings: string[] }> {
  const rows: MappingRowRef[] = proposed.map((row) => ({
    hubspotProperty: row.hubspotProperty.trim(),
    mindbodyField: row.mindbodyField.trim(),
  }));

  if (rows.some((row) => !row.hubspotProperty || !row.mindbodyField)) {
    throw new SaveMappingsError("Each mapping must include HubSpot and Mindbody fields.", []);
  }

  const hubspotProps = new Set(rows.map((row) => row.hubspotProperty));
  if (hubspotProps.size !== rows.length) {
    throw new SaveMappingsError(
      "Each HubSpot property can only be mapped once.",
      []
    );
  }

  const existing = await getFieldMappings(tenantId, entity);
  const before: MappingRowRef[] = existing.map((row) => ({
    hubspotProperty: row.hubspot_property,
    mindbodyField: row.mindbody_field,
    isSystem: row.is_system,
  }));

  const hubspotCatalogRaw = await loadHubspotCatalog(tenantId, entity);
  const hubspotCatalog: HubspotPropertyRef[] = hubspotCatalogRaw.map((p) => ({
    name: p.name,
    type: p.type,
    readOnly: p.readOnly,
  }));
  const hubspotByName = new Map(hubspotCatalogRaw.map((p) => [p.name, p]));

  const mindbodyCatalog = await loadMindbodyCatalog(tenantId, entity);

  const validation =
    entity === "contact"
      ? validateContactMappingSave(before, rows, hubspotCatalog, mindbodyCatalog)
      : mergeValidation(
          validateSystemMappingsPreserved(before, rows),
          validateMappingBatch(rows, hubspotCatalog, mindbodyCatalog)
        );

  if (!validation.ok) {
    throw new SaveMappingsError("Invalid field mappings", validation.errors);
  }

  const insertRows = rows.map((row) => {
    const hubspot = hubspotByName.get(row.hubspotProperty);
    const mindbody = mindbodyCatalog.find((f) => f.key === row.mindbodyField);
    return {
      tenant_id: tenantId,
      entity_type: entity,
      hubspot_property: row.hubspotProperty,
      mindbody_field: row.mindbodyField,
      is_custom: isHubspotCustomProperty(
        row.hubspotProperty,
        hubspot?.groupName
      ),
      is_system: resolveIsSystem(entity, row.hubspotProperty, before),
      hubspot_property_type: hubspot?.type ?? null,
      mindbody_field_type: mindbody?.type ?? null,
    };
  });

  const supabase = getSupabase();
  const { error: deleteError } = await supabase
    .from("field_mappings")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("entity_type", entity);

  if (deleteError) throw deleteError;

  const { data: inserted, error: insertError } = await supabase
    .from("field_mappings")
    .insert(insertRows)
    .select("*");

  if (insertError) throw insertError;

  return {
    mappings: (inserted ?? []).map(toFieldMappingItem),
    warnings: validation.warnings,
  };
}
