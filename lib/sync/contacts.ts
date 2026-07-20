import { getSupabase } from "@/lib/db/client";
import type { MindbodyAccount, SyncSettings } from "@/lib/db/types";
import {
  associateDealToContact,
  searchContactByMindbodyId,
  updateContact,
  upsertContact,
} from "@/lib/hubspot/crm";
import { getValidAccessToken } from "@/lib/hubspot/tokens";
import type { HubspotAccount } from "@/lib/db/types";
import {
  addOrUpdateMindbodyClient,
  fetchMindbodyClient,
} from "@/lib/mindbody/client";
import { getContact } from "@/lib/hubspot/crm";
import {
  applyContactMappings,
  getFieldMappings,
  mindbodyClientFromHubspot,
} from "@/lib/sync/field-mappings";
import { allowsSync } from "@/lib/sync/direction";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isLikelyValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

export async function syncContactMindbodyToHubspot(
  tenantId: string,
  hubspotAccount: HubspotAccount,
  mindbodyAccount: MindbodyAccount,
  settings: SyncSettings,
  clientId: string,
  runId: string
): Promise<{ hubspotId: string; action: "created" | "updated" }> {
  if (!settings.contacts_enabled) {
    throw new Error("Contact sync is disabled");
  }
  if (!allowsSync(settings.contacts_direction, "mindbody", "hubspot")) {
    throw new Error("Contact sync direction does not allow Mindbody → HubSpot");
  }

  const client = await fetchMindbodyClient(mindbodyAccount, clientId);
  if (!client) {
    throw new Error(`Mindbody client ${clientId} not found`);
  }

  const mappings = await getFieldMappings(tenantId, "contact");
  const props = applyContactMappings(
    mappings,
    client as unknown as Record<string, unknown>,
    mindbodyAccount.site_id
  );
  props.mindbody_client_id = client.Id;

  const email = props.email ? normalizeEmail(props.email) : "";
  if (!email) {
    throw new Error("Mindbody client has no email; cannot sync contact");
  }
  if (!isLikelyValidEmail(email)) {
    throw new Error(`Invalid email format for HubSpot sync: ${email}`);
  }
  props.email = email;

  const accessToken = await getValidAccessToken(hubspotAccount);
  const existingHubspotId = await searchContactByMindbodyId(accessToken, client.Id);
  let hubspotId = existingHubspotId;
  let action: "created" | "updated";

  if (hubspotId) {
    await updateContact(accessToken, hubspotId, props);
    action = "updated";
  } else {
    hubspotId = await upsertContact(accessToken, props, email);
    action = "created";
  }

  await upsertEntityMapping(
    tenantId,
    client.Id,
    hubspotId,
    "contact",
    "mindbody"
  );

  await resolvePendingDealContactAssociations(
    tenantId,
    client.Id,
    hubspotId,
    accessToken
  );

  return { hubspotId, action };
}

export async function syncContactHubspotToMindbody(
  tenantId: string,
  hubspotAccount: HubspotAccount,
  mindbodyAccount: MindbodyAccount,
  settings: SyncSettings,
  contactId: string
): Promise<{ mindbodyId: string }> {
  if (!settings.contacts_enabled) {
    throw new Error("Contact sync is disabled");
  }
  if (!allowsSync(settings.contacts_direction, "hubspot", "mindbody")) {
    throw new Error("Contact sync direction does not allow HubSpot → Mindbody");
  }

  const accessToken = await getValidAccessToken(hubspotAccount);
  const mappings = await getFieldMappings(tenantId, "contact");
  const propNames = mappings.map((m) => m.hubspot_property);
  propNames.push("mindbody_client_id", "email", "firstname", "lastname", "phone");

  const props = await getContact(accessToken, contactId, [...new Set(propNames)]);

  const { data: mapping } = await getSupabase()
    .from("entity_mappings")
    .select("last_source, last_synced_at")
    .eq("tenant_id", tenantId)
    .eq("entity_type", "contact")
    .eq("hubspot_id", contactId)
    .maybeSingle();

  if (
    mapping?.last_source === "mindbody" &&
    mapping.last_synced_at &&
    Date.now() - new Date(mapping.last_synced_at).getTime() < 10_000
  ) {
    return { mindbodyId: props.mindbody_client_id ?? "" };
  }

  const mbClient = mindbodyClientFromHubspot(mappings, props);
  if (!mbClient.Email) {
    throw new Error("HubSpot contact has no email");
  }

  const mindbodyId = await addOrUpdateMindbodyClient(mindbodyAccount, mbClient);

  await upsertEntityMapping(
    tenantId,
    mindbodyId,
    contactId,
    "contact",
    "hubspot"
  );

  return { mindbodyId };
}

async function upsertEntityMapping(
  tenantId: string,
  mindbodyId: string,
  hubspotId: string,
  entityType: "contact",
  lastSource: "hubspot" | "mindbody"
): Promise<void> {
  await getSupabase().from("entity_mappings").upsert(
    {
      tenant_id: tenantId,
      entity_type: entityType,
      hubspot_id: hubspotId,
      mindbody_id: mindbodyId,
      deal_source: null,
      last_source: lastSource,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,entity_type,hubspot_id" }
  );
}

async function resolvePendingDealContactAssociations(
  tenantId: string,
  mindbodyClientId: string,
  hubspotContactId: string,
  accessToken: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  const { data } = await getSupabase()
    .from("pending_deal_contact_links")
    .select("id, deal_hubspot_id, attempts")
    .eq("tenant_id", tenantId)
    .eq("mindbody_client_id", mindbodyClientId)
    .lte("next_attempt_at", nowIso)
    .order("created_at", { ascending: true })
    .limit(100);

  if (!data?.length) return;

  for (const row of data) {
    try {
      await associateDealToContact(
        accessToken,
        String(row.deal_hubspot_id),
        hubspotContactId
      );
      await getSupabase()
        .from("pending_deal_contact_links")
        .delete()
        .eq("id", String(row.id));
    } catch (error) {
      const attempts = Number(row.attempts ?? 0) + 1;
      const nextAttempt = new Date(Date.now() + 5 * 60_000).toISOString();
      await getSupabase()
        .from("pending_deal_contact_links")
        .update({
          attempts,
          last_error:
            error instanceof Error ? error.message : "Association retry failed",
          next_attempt_at: nextAttempt,
          updated_at: new Date().toISOString(),
        })
        .eq("id", String(row.id));
    }
  }
}
