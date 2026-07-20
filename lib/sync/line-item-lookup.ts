import { getSupabase } from "@/lib/db/client";
import { searchLineItemByMindbodyKey } from "@/lib/hubspot/line-items";

/** Resolve an existing HubSpot line item ID — DB mapping first, HubSpot search second. */
export async function findExistingLineItemHubspotId(
  tenantId: string,
  accessToken: string,
  lineItemKey: string
): Promise<string | null> {
  if (!lineItemKey) return null;

  const { data: mapping } = await getSupabase()
    .from("entity_mappings")
    .select("hubspot_id")
    .eq("tenant_id", tenantId)
    .eq("entity_type", "line_item")
    .eq("mindbody_id", lineItemKey)
    .maybeSingle();

  if (mapping?.hubspot_id) {
    return mapping.hubspot_id;
  }

  return searchLineItemByMindbodyKey(accessToken, lineItemKey);
}
