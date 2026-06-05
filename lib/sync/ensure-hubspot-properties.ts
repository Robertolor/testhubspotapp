import { getSupabase } from "@/lib/db/client";
import type { HubspotAccount } from "@/lib/db/types";
import { bootstrapHubspotProperties } from "@/lib/hubspot/properties";
import { getValidAccessToken } from "@/lib/hubspot/tokens";

/** Create Mindbody custom properties in HubSpot (idempotent). */
export async function ensureHubspotPropertiesForTenant(
  tenantId: string,
  hubspotAccount: HubspotAccount
): Promise<void> {
  const token = await getValidAccessToken(hubspotAccount);
  await bootstrapHubspotProperties(token);
  await getSupabase()
    .from("sync_settings")
    .update({
      hubspot_properties_bootstrapped: true,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
}
