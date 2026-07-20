import { getSupabase } from "@/lib/db/client";
import type { EntityType, MindbodyMappingSource } from "@/lib/db/types";
import { mindbodyFieldsForMapping } from "@/lib/mapping/entity-fields";
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
  SYSTEM_CONTRACT_MAPPING_PAIRS,
  SYSTEM_LINE_ITEM_MAPPING_PAIRS,
  SYSTEM_SALE_MAPPING_PAIRS,
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

function hubspotObjectForEntity(
  entity: EntityType
): HubspotCatalogObject {
  if (entity === "contact") return "contacts";
  if (entity === "line_item") return "line_items";
  return "deals";
}

function systemPairsForEntity(
  entity: EntityType,
  mindbodySource?: MindbodyMappingSource
): MappingRowRef[] {
  if (entity === "contact") return SYSTEM_CONTACT_MAPPING_PAIRS;
  if (entity === "line_item") return SYSTEM_LINE_ITEM_MAPPING_PAIRS;
  if (mindbodySource === "sale") return SYSTEM_SALE_MAPPING_PAIRS;
  if (mindbodySource === "contract") return SYSTEM_CONTRACT_MAPPING_PAIRS;
  return [...SYSTEM_SALE_MAPPING_PAIRS, ...SYSTEM_CONTRACT_MAPPING_PAIRS];
}

function resolveIsSystem(
  entity: EntityType,
  hubspotProperty: string,
  existing: MappingRowRef[],
  mindbodySource?: MindbodyMappingSource
): boolean {
  const prev = existing.find((row) => row.hubspotProperty === hubspotProperty);
  if (prev?.isSystem) return true;
  return systemPairsForEntity(entity, mindbodySource).some(
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
  entity: EntityType,
  mindbodySource?: MindbodyMappingSource
): Promise<MindbodyFieldRef[]> {
  if (entity === "contact") {
    const mindbodyAccount = await getMindbodyAccountByTenant(tenantId);
    if (!mindbodyAccount?.api_key_encrypted) {
      throw new Error("Mindbody is not configured for this tenant");
    }

    const fields = await listMindbodyContactFields(mindbodyAccount);
    return fields.map((field) => ({ key: field.key, type: field.type }));
  }

  return mindbodyFieldsForMapping(entity, mindbodySource);
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
  proposed: SaveMappingInput[],
  options?: { mindbodySource?: MindbodyMappingSource }
): Promise<{ mappings: FieldMappingItem[]; warnings: string[] }> {
  const mindbodySource = entity === "deal" ? options?.mindbodySource : undefined;
  if (entity === "deal" && !mindbodySource) {
    throw new SaveMappingsError(
      "Deal mappings require mindbodySource (sale, contract, appointment, or visit).",
      []
    );
  }
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

  const existing =
    entity === "deal" && mindbodySource
      ? await getFieldMappings(tenantId, entity, { mindbodySource })
      : await getFieldMappings(tenantId, entity);
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

  const mindbodyCatalog = await loadMindbodyCatalog(
    tenantId,
    entity,
    mindbodySource
  );

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
      is_system: resolveIsSystem(
        entity,
        row.hubspotProperty,
        before,
        mindbodySource
      ),
      hubspot_property_type: hubspot?.type ?? null,
      mindbody_field_type: mindbody?.type ?? null,
      ...(entity === "deal" && mindbodySource
        ? { mindbody_source: mindbodySource }
        : {}),
    };
  });

  const supabase = getSupabase();
  let deleteQuery = supabase
    .from("field_mappings")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("entity_type", entity);

  if (entity === "deal" && mindbodySource) {
    deleteQuery = deleteQuery.eq("mindbody_source", mindbodySource);
  }

  const { error: deleteError } = await deleteQuery;

  if (deleteError) throw deleteError;

  const { data: inserted, error: insertError } = await supabase
    .from("field_mappings")
    .insert(insertRows)
    .select("*");

  if (insertError) throw insertError;

  const saved =
    entity === "deal" && mindbodySource
      ? await getFieldMappings(tenantId, entity, { mindbodySource })
      : ((inserted ?? []) as Awaited<ReturnType<typeof getFieldMappings>>);

  return {
    mappings: saved.map(toFieldMappingItem),
    warnings: validation.warnings,
  };
}
