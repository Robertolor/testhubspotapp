import { getSupabase } from "@/lib/db/client";
import type { EntityType, WebhookSource } from "@/lib/db/types";
import { getHubspotAccountByTenant } from "@/lib/hubspot/tokens";
import { bootstrapHubspotProperties } from "@/lib/hubspot/properties";
import { getValidAccessToken } from "@/lib/hubspot/tokens";
import { getMindbodyAccountByTenant } from "@/lib/mindbody/client";
import {
  syncContactHubspotToMindbody,
  syncContactMindbodyToHubspot,
} from "@/lib/sync/contacts";
import { syncContractToHubspotDeal, syncSaleToHubspotDeal } from "@/lib/sync/deals";
import {
  completeSyncRun,
  createSyncRun,
  logSyncError,
  logSyncEvent,
} from "@/lib/sync/runs";
import type { SyncSettings } from "@/lib/db/types";

export interface ProcessWebhookInput {
  tenantId: string;
  source: WebhookSource;
  deliveryId: string;
  payload: unknown;
}

export async function processWebhookDelivery(
  input: ProcessWebhookInput
): Promise<void> {
  const { tenantId, source, deliveryId, payload } = input;

  const settings = await getSyncSettings(tenantId);
  const hubspotAccount = await getHubspotAccountByTenant(tenantId);
  const mindbodyAccount = await getMindbodyAccountByTenant(tenantId);

  if (!hubspotAccount) {
    throw new Error("HubSpot account not connected");
  }

  const runId = await createSyncRun(
    tenantId,
    source === "hubspot" ? "hubspot" : "mindbody"
  );

  let processed = 0;
  let failed = 0;

  try {
    if (!settings.hubspot_properties_bootstrapped) {
      const token = await getValidAccessToken(hubspotAccount);
      await bootstrapHubspotProperties(token);
      await getSupabase()
        .from("sync_settings")
        .update({ hubspot_properties_bootstrapped: true })
        .eq("tenant_id", tenantId);
    }

    if (source === "hubspot") {
      const events = Array.isArray(payload) ? payload : [payload];
      for (const event of events) {
        try {
          await processHubspotEvent(
            tenantId,
            hubspotAccount,
            mindbodyAccount,
            settings,
            event as Record<string, unknown>,
            runId
          );
          processed++;
        } catch (e) {
          failed++;
          await logSyncError(
            tenantId,
            e instanceof Error ? e.message : "HubSpot event failed",
            {
              syncRunId: runId,
              source: "hubspot",
              externalId: String(
                (event as Record<string, unknown>).objectId ?? ""
              ),
            }
          );
        }
      }
    } else {
      const event = payload as Record<string, unknown>;
      await processMindbodyEvent(
        tenantId,
        hubspotAccount,
        mindbodyAccount,
        settings,
        event,
        runId
      );
      processed++;
    }

    await completeSyncRun(
      runId,
      failed > 0 ? (processed > 0 ? "partial" : "failed") : "completed",
      processed,
      failed
    );

    await getSupabase()
      .from("webhook_deliveries")
      .update({
        status: failed > 0 && processed === 0 ? "failed" : "processed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", deliveryId);
  } catch (e) {
    await completeSyncRun(runId, "failed", processed, failed + 1);
    await getSupabase()
      .from("webhook_deliveries")
      .update({
        status: "failed",
        error_message: e instanceof Error ? e.message : "Processing failed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", deliveryId);
    throw e;
  }
}

async function getSyncSettings(tenantId: string): Promise<SyncSettings> {
  const { data, error } = await getSupabase()
    .from("sync_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();
  if (error || !data) {
    throw new Error("Sync settings not found");
  }
  return data as SyncSettings;
}

async function processHubspotEvent(
  tenantId: string,
  hubspotAccount: NonNullable<Awaited<ReturnType<typeof getHubspotAccountByTenant>>>,
  mindbodyAccount: Awaited<ReturnType<typeof getMindbodyAccountByTenant>>,
  settings: SyncSettings,
  event: Record<string, unknown>,
  runId: string
): Promise<void> {
  const subType = String(event.subscriptionType ?? "");
  const objectId = String(event.objectId ?? "");

  if (subType.startsWith("contact.") && mindbodyAccount) {
    if (!settings.contacts_enabled) return;
    const result = await syncContactHubspotToMindbody(
      tenantId,
      hubspotAccount,
      mindbodyAccount,
      settings,
      objectId
    );
    await logSyncEvent(
      runId,
      tenantId,
      "contact",
      "hs_to_mb",
      "success",
      undefined,
      objectId,
      result.mindbodyId
    );
    return;
  }

  if (subType.startsWith("deal.")) {
    await logSyncEvent(
      runId,
      tenantId,
      "deal",
      "hs_to_mb",
      "skipped",
      "HubSpot → Mindbody deal sync not yet implemented"
    );
  }
}

async function processMindbodyEvent(
  tenantId: string,
  hubspotAccount: NonNullable<Awaited<ReturnType<typeof getHubspotAccountByTenant>>>,
  mindbodyAccount: Awaited<ReturnType<typeof getMindbodyAccountByTenant>>,
  settings: SyncSettings,
  event: Record<string, unknown>,
  runId: string
): Promise<void> {
  if (!mindbodyAccount) {
    throw new Error("Mindbody account not configured");
  }

  const eventId = String(event.eventId ?? "");
  const data = (event.data ?? event) as Record<string, unknown>;

  if (eventId === "client.created" || eventId === "client.updated") {
    const clientId = String(data.clientId ?? data.Id ?? "");
    const result = await syncContactMindbodyToHubspot(
      tenantId,
      hubspotAccount,
      mindbodyAccount,
      settings,
      clientId,
      runId
    );
    await logSyncEvent(
      runId,
      tenantId,
      "contact",
      "mb_to_hs",
      "success",
      undefined,
      clientId,
      result.hubspotId
    );
    return;
  }

  if (
    eventId === "clientContract.created" ||
    eventId === "clientContract.updated"
  ) {
    const result = await syncContractToHubspotDeal(
      tenantId,
      hubspotAccount,
      mindbodyAccount,
      settings,
      data
    );
    await logSyncEvent(
      runId,
      tenantId,
      "deal",
      "mb_to_hs",
      "success",
      undefined,
      String(data.clientContractId ?? ""),
      result.dealId
    );
    return;
  }

  if (eventId === "clientSale.created") {
    const result = await syncSaleToHubspotDeal(
      tenantId,
      hubspotAccount,
      settings,
      data
    );
    await logSyncEvent(
      runId,
      tenantId,
      "deal",
      "mb_to_hs",
      "success",
      undefined,
      String(data.saleId ?? ""),
      result.dealId
    );
  }
}

export async function runBackfill(
  tenantId: string,
  entityType: EntityType
): Promise<string> {
  const hubspotAccount = await getHubspotAccountByTenant(tenantId);
  const mindbodyAccount = await getMindbodyAccountByTenant(tenantId);
  const settings = await getSyncSettings(tenantId);

  if (!hubspotAccount || !mindbodyAccount) {
    throw new Error("Both HubSpot and Mindbody must be connected");
  }

  const runId = await createSyncRun(tenantId, "manual", entityType);
  let processed = 0;
  let failed = 0;

  if (entityType === "contact" && settings.contacts_enabled) {
    const { listMindbodyClients } = await import("@/lib/mindbody/client");
    const limit = 100;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const clients = await listMindbodyClients(
        mindbodyAccount,
        offset,
        limit
      );
      for (const c of clients) {
        try {
          await syncContactMindbodyToHubspot(
            tenantId,
            hubspotAccount,
            mindbodyAccount,
            settings,
            c.Id,
            runId
          );
          processed++;
        } catch (e) {
          failed++;
          await logSyncError(
            tenantId,
            e instanceof Error ? e.message : "Backfill contact failed",
            {
              syncRunId: runId,
              entityType: "contact",
              externalId: c.Id,
            }
          );
        }
      }
      offset += limit;
      hasMore = clients.length === limit;
    }
  }

  await completeSyncRun(
    runId,
    failed > 0 ? (processed > 0 ? "partial" : "failed") : "completed",
    processed,
    failed
  );

  return runId;
}
