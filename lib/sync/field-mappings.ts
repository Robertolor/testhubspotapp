import { getSupabase } from "@/lib/db/client";
import type { EntityType, FieldMapping, MindbodyDealSource } from "@/lib/db/types";
import { extractMindbodyValue, formatForHubspot, mapMindbodyFieldsToHubspot } from "@/lib/mapping/transform";

type DefaultFieldMapping = Omit<FieldMapping, "id" | "tenant_id" | "created_at">;

export const DEFAULT_CONTACT_MAPPINGS: DefaultFieldMapping[] = [
  {
    entity_type: "contact",
    hubspot_property: "email",
    mindbody_field: "Email",
    is_custom: false,
    is_system: true,
    hubspot_property_type: "string",
    mindbody_field_type: "string",
    mindbody_source: null,
  },
  {
    entity_type: "contact",
    hubspot_property: "firstname",
    mindbody_field: "FirstName",
    is_custom: false,
    is_system: false,
    hubspot_property_type: "string",
    mindbody_field_type: "string",
    mindbody_source: null,
  },
  {
    entity_type: "contact",
    hubspot_property: "lastname",
    mindbody_field: "LastName",
    is_custom: false,
    is_system: false,
    hubspot_property_type: "string",
    mindbody_field_type: "string",
    mindbody_source: null,
  },
  {
    entity_type: "contact",
    hubspot_property: "phone",
    mindbody_field: "MobilePhone",
    is_custom: false,
    is_system: false,
    hubspot_property_type: "string",
    mindbody_field_type: "string",
    mindbody_source: null,
  },
  {
    entity_type: "contact",
    hubspot_property: "mindbody_client_id",
    mindbody_field: "Id",
    is_custom: true,
    is_system: true,
    hubspot_property_type: "string",
    mindbody_field_type: "string",
    mindbody_source: null,
  },
];

export const DEFAULT_DEAL_MAPPINGS: DefaultFieldMapping[] = [
  {
    entity_type: "deal",
    hubspot_property: "dealname",
    mindbody_field: "contractName",
    is_custom: false,
    is_system: false,
    hubspot_property_type: "string",
    mindbody_field_type: "string",
    mindbody_source: "contract",
  },
  {
    entity_type: "deal",
    hubspot_property: "amount",
    mindbody_field: "totalAmount",
    is_custom: false,
    is_system: false,
    hubspot_property_type: "number",
    mindbody_field_type: "number",
    mindbody_source: "sale",
  },
  {
    entity_type: "deal",
    hubspot_property: "closedate",
    mindbody_field: "contractStartDateTime",
    is_custom: false,
    is_system: false,
    hubspot_property_type: "datetime",
    mindbody_field_type: "datetime",
    mindbody_source: "contract",
  },
  {
    entity_type: "deal",
    hubspot_property: "deal_source",
    mindbody_field: "deal_source",
    is_custom: true,
    is_system: false,
    hubspot_property_type: "enumeration",
    mindbody_field_type: "string",
    mindbody_source: "contract",
  },
];

export async function seedDefaultFieldMappings(tenantId: string): Promise<void> {
  const rows = [...DEFAULT_CONTACT_MAPPINGS, ...DEFAULT_DEAL_MAPPINGS].map(
    (m) => ({ ...m, tenant_id: tenantId })
  );

  for (const row of rows) {
    await getSupabase().from("field_mappings").upsert(row, {
      onConflict: "tenant_id,entity_type,hubspot_property",
      ignoreDuplicates: true,
    });
  }
}

export async function getFieldMappings(
  tenantId: string,
  entityType: EntityType,
  options?: { mindbodySource?: MindbodyDealSource }
): Promise<FieldMapping[]> {
  let query = getSupabase()
    .from("field_mappings")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("entity_type", entityType);

  if (entityType === "deal" && options?.mindbodySource) {
    query = query.eq("mindbody_source", options.mindbodySource);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as FieldMapping[];
}

export function filterDealMappingsForSource(
  mappings: FieldMapping[],
  source: MindbodyDealSource
): FieldMapping[] {
  return mappings.filter(
    (mapping) =>
      mapping.entity_type === "deal" && mapping.mindbody_source === source
  );
}

export function applyDealMappings(
  mappings: FieldMapping[],
  payload: Record<string, unknown>,
  source: MindbodyDealSource
): Record<string, string> {
  const scoped = filterDealMappingsForSource(mappings, source);
  return mapMindbodyFieldsToHubspot(scoped, payload);
}

export function applyContactMappings(
  mappings: FieldMapping[],
  mindbody: Record<string, unknown>,
  siteId: number
): Record<string, string> {
  const props: Record<string, string> = {
    ...mapMindbodyFieldsToHubspot(mappings, mindbody),
    mindbody_site_id: String(siteId),
    mindbody_last_synced_at: new Date().toISOString(),
  };

  if (!props.phone) {
    const homePhone = extractMindbodyValue(mindbody, "HomePhone");
    const formatted = formatForHubspot(homePhone, "string", "string");
    if (formatted) props.phone = formatted;
  }

  return props;
}

export function mindbodyClientFromHubspot(
  mappings: FieldMapping[],
  props: Record<string, string>
): {
  FirstName: string;
  LastName: string;
  Email: string;
  MobilePhone?: string;
  Id?: string;
} {
  const get = (field: string) =>
    mappings.find((m) => m.mindbody_field === field)?.hubspot_property;

  const emailKey = get("Email") ?? "email";
  const fnKey = get("FirstName") ?? "firstname";
  const lnKey = get("LastName") ?? "lastname";
  const phoneKey = get("MobilePhone") ?? "phone";

  return {
    FirstName: props[fnKey] ?? "",
    LastName: props[lnKey] ?? "",
    Email: props[emailKey] ?? "",
    MobilePhone: props[phoneKey],
    Id: props.mindbody_client_id,
  };
}
