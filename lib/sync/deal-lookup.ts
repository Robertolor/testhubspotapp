import { getSupabase } from "@/lib/db/client";
import { searchDealByMindbodyId } from "@/lib/hubspot/crm";

type MindbodyDealProperty =
  | "mindbody_contract_id"
  | "mindbody_sale_id"
  | "mindbody_appointment_id"
  | "mindbody_visit_id";

/** Resolve an existing HubSpot deal ID — DB mapping first, HubSpot search second. */
export async function findExistingDealHubspotId(
  tenantId: string,
  accessToken: string,
  propertyName: MindbodyDealProperty,
  mindbodyId: string,
  dealSource: string
): Promise<string | null> {
  if (!mindbodyId) return null;

  const { data: mapping } = await getSupabase()
    .from("entity_mappings")
    .select("hubspot_id")
    .eq("tenant_id", tenantId)
    .eq("entity_type", "deal")
    .eq("mindbody_id", mindbodyId)
    .eq("deal_source", dealSource)
    .maybeSingle();

  if (mapping?.hubspot_id) {
    return mapping.hubspot_id;
  }

  return searchDealByMindbodyId(accessToken, propertyName, mindbodyId);
}
