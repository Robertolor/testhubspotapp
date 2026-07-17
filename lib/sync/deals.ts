import { getSupabase } from "@/lib/db/client";
import type {
  HubspotAccount,
  MindbodyAccount,
  SyncSettings,
} from "@/lib/db/types";
import {
  associateDealToContact,
  createDeal,
  searchDealByMindbodyId,
  updateDeal,
} from "@/lib/hubspot/crm";
import { getValidAccessToken } from "@/lib/hubspot/tokens";
import { searchContactByMindbodyId } from "@/lib/hubspot/crm";
import { allowsSync } from "@/lib/sync/direction";
import {
  applyDealMappings,
  getFieldMappings,
} from "@/lib/sync/field-mappings";
import {
  purchaseQualifiesForSync,
  shouldAssociateDealToContact,
} from "@/lib/sync/runtime-rules";
import { normalizeAppointmentPayload } from "@/lib/sync/appointments";
import { normalizeVisitPayload } from "@/lib/sync/visits";

async function queuePendingDealContactAssociation(
  tenantId: string,
  dealId: string,
  mindbodyClientId: string,
  reason: string
): Promise<void> {
  if (!mindbodyClientId) return;
  await getSupabase().from("pending_deal_contact_links").upsert(
    {
      tenant_id: tenantId,
      deal_hubspot_id: dealId,
      mindbody_client_id: mindbodyClientId,
      reason,
      next_attempt_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,deal_hubspot_id,mindbody_client_id" }
  );
}

async function clearPendingDealContactAssociation(
  tenantId: string,
  dealId: string,
  mindbodyClientId: string
): Promise<void> {
  await getSupabase()
    .from("pending_deal_contact_links")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("deal_hubspot_id", dealId)
    .eq("mindbody_client_id", mindbodyClientId);
}

export async function syncContractToHubspotDeal(
  tenantId: string,
  hubspotAccount: HubspotAccount,
  _mindbodyAccount: MindbodyAccount,
  settings: SyncSettings,
  payload: Record<string, unknown>
): Promise<{ dealId: string }> {
  if (!settings.deals_enabled) {
    throw new Error("Deal sync is disabled");
  }
  if (!allowsSync(settings.deals_direction, "mindbody", "hubspot")) {
    throw new Error("Deal sync direction does not allow Mindbody → HubSpot");
  }

  const clientUniqueId = String(payload.clientUniqueId ?? "");
  const clientContractId = String(payload.clientContractId ?? "");
  const contractName = String(payload.contractName ?? "Mindbody Contract");

  if (!clientContractId) {
    throw new Error("Missing clientContractId in contract webhook");
  }

  const accessToken = await getValidAccessToken(hubspotAccount);
  let dealId = await searchDealByMindbodyId(
    accessToken,
    "mindbody_contract_id",
    clientContractId
  );

  const contactId =
    shouldAssociateDealToContact(settings) && clientUniqueId
      ? await searchContactByMindbodyId(accessToken, clientUniqueId)
      : null;

  const mappings = await getFieldMappings(tenantId, "deal");
  const normalizedPayload: Record<string, unknown> = {
    clientContractId,
    clientUniqueId,
    contractName,
    contractStartDateTime: payload.contractStartDateTime,
    contractEndDateTime: payload.contractEndDateTime,
    agreementDate: payload.agreementDate,
    autopayStatus: payload.autopayStatus,
    locationId: payload.locationId,
    deal_source: "mindbody_contract",
  };

  const dealProps = {
    ...applyDealMappings(mappings, normalizedPayload, "contract"),
    deal_source: "mindbody_contract",
    mindbody_contract_id: clientContractId,
    mindbody_client_id: clientUniqueId,
    closedate: payload.contractStartDateTime
      ? String(payload.contractStartDateTime).split("T")[0]
      : undefined,
  };

  if (dealId) {
    await updateDeal(accessToken, dealId, dealProps);
    if (contactId && shouldAssociateDealToContact(settings)) {
      await associateDealToContact(accessToken, dealId, contactId);
    }
  } else {
    dealId = await createDeal(accessToken, dealProps, contactId ?? undefined);
  }

  await getSupabase().from("entity_mappings").upsert(
    {
      tenant_id: tenantId,
      entity_type: "deal",
      hubspot_id: dealId,
      mindbody_id: clientContractId,
      deal_source: "mindbody_contract",
      last_source: "mindbody",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,entity_type,hubspot_id" }
  );

  if (shouldAssociateDealToContact(settings)) {
    if (contactId) {
      await clearPendingDealContactAssociation(tenantId, dealId, clientUniqueId);
    } else {
      await queuePendingDealContactAssociation(
        tenantId,
        dealId,
        clientUniqueId,
        "Contact was missing when contract webhook was processed"
      );
    }
  }

  return { dealId };
}

export async function syncSaleToHubspotDeal(
  tenantId: string,
  hubspotAccount: HubspotAccount,
  settings: SyncSettings,
  payload: Record<string, unknown>
): Promise<{ dealId: string }> {
  if (!settings.deals_enabled) {
    throw new Error("Deal sync is disabled");
  }
  if (!allowsSync(settings.deals_direction, "mindbody", "hubspot")) {
    throw new Error("Deal sync direction does not allow Mindbody → HubSpot");
  }

  const saleId = String(payload.saleId ?? payload.id ?? "");
  const clientId = String(payload.clientId ?? payload.clientUniqueId ?? "");

  if (!saleId) {
    throw new Error("Missing sale id in sale webhook");
  }

  const accessToken = await getValidAccessToken(hubspotAccount);
  let dealId = await searchDealByMindbodyId(
    accessToken,
    "mindbody_sale_id",
    saleId
  );

  const amount = payload.totalAmount ?? payload.paymentsTotal;

  const qualification = purchaseQualifiesForSync(settings, amount);
  if (!qualification.qualifies) {
    throw new Error(qualification.reason ?? "Purchase does not qualify for sync");
  }

  const contactId =
    shouldAssociateDealToContact(settings) && clientId
      ? await searchContactByMindbodyId(accessToken, clientId)
      : null;

  const mappings = await getFieldMappings(tenantId, "deal");
  const normalizedPayload: Record<string, unknown> = {
    saleId,
    clientId,
    clientUniqueId: clientId,
    totalAmount: amount,
    paymentsTotal: payload.paymentsTotal ?? amount,
    amount,
    saleDateTime: payload.saleDateTime ?? payload.originalSaleDateTime,
    originalSaleDateTime: payload.originalSaleDateTime,
    deal_source: "mindbody_sale",
  };

  const dealProps = {
    ...applyDealMappings(mappings, normalizedPayload, "sale"),
    deal_source: "mindbody_sale",
    mindbody_sale_id: saleId,
    mindbody_client_id: clientId,
    amount: amount !== undefined ? String(amount) : undefined,
  };

  if (dealId) {
    await updateDeal(accessToken, dealId, dealProps);
    if (contactId && shouldAssociateDealToContact(settings)) {
      await associateDealToContact(accessToken, dealId, contactId);
    }
  } else {
    dealId = await createDeal(accessToken, dealProps, contactId ?? undefined);
  }

  await getSupabase().from("entity_mappings").upsert(
    {
      tenant_id: tenantId,
      entity_type: "deal",
      hubspot_id: dealId,
      mindbody_id: saleId,
      deal_source: "mindbody_sale",
      last_source: "mindbody",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,entity_type,hubspot_id" }
  );

  if (shouldAssociateDealToContact(settings)) {
    if (contactId) {
      await clearPendingDealContactAssociation(tenantId, dealId, clientId);
    } else {
      await queuePendingDealContactAssociation(
        tenantId,
        dealId,
        clientId,
        "Contact was missing when sale webhook was processed"
      );
    }
  }

  return { dealId };
}

export async function syncAppointmentToHubspotDeal(
  tenantId: string,
  hubspotAccount: HubspotAccount,
  settings: SyncSettings,
  payload: Record<string, unknown>
): Promise<{ dealId: string }> {
  if (!settings.appointments_enabled) {
    throw new Error("Appointment sync is disabled");
  }
  if (!settings.deals_enabled) {
    throw new Error("Deal sync is disabled");
  }
  if (!allowsSync(settings.deals_direction, "mindbody", "hubspot")) {
    throw new Error("Deal sync direction does not allow Mindbody → HubSpot");
  }

  const normalized =
    payload.mindbody_appointment_id != null
      ? payload
      : normalizeAppointmentPayload(payload);

  const appointmentId = String(normalized.mindbody_appointment_id ?? "");
  const clientId = String(
    normalized.resolved_contact_client_id ??
      normalized.source_client_reference ??
      ""
  );

  if (!appointmentId) {
    throw new Error("Missing appointment id");
  }

  const accessToken = await getValidAccessToken(hubspotAccount);
  let dealId = await searchDealByMindbodyId(
    accessToken,
    "mindbody_appointment_id",
    appointmentId
  );

  const contactId =
    shouldAssociateDealToContact(settings) && clientId
      ? await searchContactByMindbodyId(accessToken, clientId)
      : null;

  const mappings = await getFieldMappings(tenantId, "deal");
  const dealProps = {
    ...applyDealMappings(mappings, normalized, "appointment"),
    deal_source: "mindbody_appointment",
    mindbody_appointment_id: appointmentId,
    mindbody_client_id: clientId || undefined,
    dealname:
      String(normalized.deal_name ?? "") || `Appointment ${appointmentId}`,
  };

  if (dealId) {
    await updateDeal(accessToken, dealId, dealProps);
    if (contactId && shouldAssociateDealToContact(settings)) {
      await associateDealToContact(accessToken, dealId, contactId);
    }
  } else {
    dealId = await createDeal(accessToken, dealProps, contactId ?? undefined);
  }

  await getSupabase().from("entity_mappings").upsert(
    {
      tenant_id: tenantId,
      entity_type: "deal",
      hubspot_id: dealId,
      mindbody_id: appointmentId,
      deal_source: "mindbody_appointment",
      last_source: "mindbody",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,entity_type,hubspot_id" }
  );

  if (shouldAssociateDealToContact(settings)) {
    if (contactId) {
      await clearPendingDealContactAssociation(tenantId, dealId, clientId);
    } else if (clientId) {
      await queuePendingDealContactAssociation(
        tenantId,
        dealId,
        clientId,
        "Contact was missing when appointment sync ran"
      );
    }
  }

  return { dealId };
}

export async function syncVisitToHubspotDeal(
  tenantId: string,
  hubspotAccount: HubspotAccount,
  settings: SyncSettings,
  payload: Record<string, unknown>
): Promise<{ dealId: string }> {
  if (!settings.visits_enabled) {
    throw new Error("Visit sync is disabled");
  }
  if (!settings.deals_enabled) {
    throw new Error("Deal sync is disabled");
  }
  if (!allowsSync(settings.deals_direction, "mindbody", "hubspot")) {
    throw new Error("Deal sync direction does not allow Mindbody → HubSpot");
  }

  const clientIdHint = String(payload.source_client_id ?? "");
  const normalized =
    payload.mindbody_visit_id != null
      ? payload
      : normalizeVisitPayload(payload, clientIdHint);

  const visitId = String(normalized.mindbody_visit_id ?? "");
  const clientId = String(normalized.source_client_id ?? clientIdHint ?? "");

  if (!visitId) {
    throw new Error("Missing visit id");
  }

  const accessToken = await getValidAccessToken(hubspotAccount);
  let dealId = await searchDealByMindbodyId(
    accessToken,
    "mindbody_visit_id",
    visitId
  );

  const contactId =
    shouldAssociateDealToContact(settings) && clientId
      ? await searchContactByMindbodyId(accessToken, clientId)
      : null;

  const mappings = await getFieldMappings(tenantId, "deal");
  const dealProps = {
    ...applyDealMappings(mappings, normalized, "visit"),
    deal_source: "mindbody_visit",
    mindbody_visit_id: visitId,
    mindbody_client_id: clientId || undefined,
    dealname: String(normalized.deal_name ?? "") || `Visit ${visitId}`,
  };

  if (dealId) {
    await updateDeal(accessToken, dealId, dealProps);
    if (contactId && shouldAssociateDealToContact(settings)) {
      await associateDealToContact(accessToken, dealId, contactId);
    }
  } else {
    dealId = await createDeal(accessToken, dealProps, contactId ?? undefined);
  }

  await getSupabase().from("entity_mappings").upsert(
    {
      tenant_id: tenantId,
      entity_type: "deal",
      hubspot_id: dealId,
      mindbody_id: visitId,
      deal_source: "mindbody_visit",
      last_source: "mindbody",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,entity_type,hubspot_id" }
  );

  if (shouldAssociateDealToContact(settings)) {
    if (contactId) {
      await clearPendingDealContactAssociation(tenantId, dealId, clientId);
    } else if (clientId) {
      await queuePendingDealContactAssociation(
        tenantId,
        dealId,
        clientId,
        "Contact was missing when visit sync ran"
      );
    }
  }

  return { dealId };
}
