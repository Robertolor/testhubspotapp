import { getHubspotAccountByTenant } from "@/lib/hubspot/tokens";
import {
  fetchClientContracts,
  getMindbodyAccountByTenant,
  listMindbodyClients,
  listMindbodySales,
  listMindbodyStaffAppointments,
} from "@/lib/mindbody/client";
import type { EntityType, SyncSettings } from "@/lib/db/types";
import { getSupabase } from "@/lib/db/client";
import { syncContactMindbodyToHubspot } from "@/lib/sync/contacts";
import {
  syncAppointmentToHubspotDeal,
  syncContractToHubspotDeal,
  syncSaleToHubspotDeal,
} from "@/lib/sync/deals";
import { normalizeAppointmentPayload } from "@/lib/sync/appointments";
import { ensureHubspotPropertiesForTenant } from "@/lib/sync/ensure-hubspot-properties";
import {
  completeSyncRun,
  createSyncRun,
} from "@/lib/sync/runs";
import { normalizeSyncSettings } from "@/lib/sync/runtime-rules";
import { TestSyncLogger } from "@/lib/sync/test-logger";

/** TEMP: sandbox E2E cap — remove or gate behind env before production */
export const TEST_SYNC_RECORD_LIMIT = 20;

type DealTestItem =
  | { kind: "sale"; payload: Record<string, unknown> }
  | { kind: "contract"; payload: Record<string, unknown> }
  | { kind: "appointment"; payload: Record<string, unknown> };

async function getSyncSettings(tenantId: string): Promise<SyncSettings> {
  const { data, error } = await getSupabase()
    .from("sync_settings")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();
  if (error || !data) {
    throw new Error("Sync settings not found");
  }
  return normalizeSyncSettings(data as Record<string, unknown>);
}

function normalizeSalePayload(sale: Record<string, unknown>): Record<string, unknown> {
  return {
    saleId: String(sale.Id ?? sale.SaleId ?? sale.saleId ?? ""),
    clientId: String(sale.ClientId ?? sale.clientId ?? sale.ClientUniqueId ?? ""),
    totalAmount: sale.TotalAmount ?? sale.PaymentsTotal ?? sale.Amount,
  };
}

function normalizeContractPayload(
  contract: Record<string, unknown>,
  clientId: string
): Record<string, unknown> {
  return {
    clientContractId: String(
      contract.Id ?? contract.ClientContractId ?? contract.clientContractId ?? ""
    ),
    clientUniqueId: String(
      contract.ClientId ?? contract.ClientUniqueId ?? clientId
    ),
    contractName: String(
      contract.ContractName ?? contract.Name ?? contract.contractName ?? "Mindbody Contract"
    ),
    contractStartDateTime:
      contract.StartDate ??
      contract.ContractStartDateTime ??
      contract.contractStartDateTime,
  };
}

async function loadTestDealItems(
  mindbodyAccount: NonNullable<Awaited<ReturnType<typeof getMindbodyAccountByTenant>>>,
  limit: number,
  log: TestSyncLogger,
  settings: SyncSettings
): Promise<DealTestItem[]> {
  const items: DealTestItem[] = [];

  log.step("loadTestDealItems.start", { limit });

  const sales = await listMindbodySales(mindbodyAccount, 0, limit);
  log.step("listMindbodySales.done", { returned: sales.length });

  for (const sale of sales) {
    const payload = normalizeSalePayload(sale as Record<string, unknown>);
    if (!payload.saleId) continue;
    items.push({ kind: "sale", payload });
    if (items.length >= limit) return items;
  }

  log.step("loadTestDealItems.scanContracts", {
    salesFound: items.length,
    needMore: limit - items.length,
  });

  const clients = await listMindbodyClients(mindbodyAccount, 0, 10);
  log.step("listMindbodyClients.forContracts", { clientCount: clients.length });

  for (const client of clients) {
    const contracts = await fetchClientContracts(mindbodyAccount, client.Id);
    log.step("fetchClientContracts", {
      clientId: client.Id,
      contractCount: contracts.length,
    });

    for (const contract of contracts) {
      const payload = normalizeContractPayload(
        contract as Record<string, unknown>,
        client.Id
      );
      if (!payload.clientContractId) continue;
      items.push({ kind: "contract", payload });
      if (items.length >= limit) return items;
    }
  }

  if (settings.appointments_enabled && items.length < limit) {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 30);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = end.toISOString().slice(0, 10);
    const remaining = limit - items.length;

    log.step("listMindbodyStaffAppointments.start", {
      startDate,
      endDate,
      remaining,
    });

    const appointments = await listMindbodyStaffAppointments(mindbodyAccount, {
      startDate,
      endDate,
      offset: 0,
      limit: remaining,
    });
    log.step("listMindbodyStaffAppointments.done", {
      returned: appointments.length,
    });

    for (const row of appointments) {
      const payload = normalizeAppointmentPayload(row);
      if (!payload.mindbody_appointment_id) continue;
      items.push({ kind: "appointment", payload });
      if (items.length >= limit) break;
    }
  }

  log.step("loadTestDealItems.done", { total: items.length });
  return items;
}

/**
 * TEMP: Sync at most TEST_SYNC_RECORD_LIMIT records for sandbox validation.
 * Logs every phase to console + sync_events / sync_errors.
 */
export async function runTestSync(
  tenantId: string,
  entityType: EntityType
): Promise<string> {
  const hubspotAccount = await getHubspotAccountByTenant(tenantId);
  const mindbodyAccount = await getMindbodyAccountByTenant(tenantId);
  const settings = await getSyncSettings(tenantId);

  if (!hubspotAccount || !mindbodyAccount) {
    throw new Error("Both HubSpot and Mindbody must be connected");
  }

  const runId = await createSyncRun(tenantId, "manual", entityType, {
    mode: "test_sync",
    limit: TEST_SYNC_RECORD_LIMIT,
  });

  const log = new TestSyncLogger(tenantId, runId, entityType);
  let processed = 0;
  let failed = 0;
  let runCompleted = false;

  const finishRun = async (
    status: "completed" | "partial" | "failed",
    p = processed,
    f = failed
  ) => {
    if (runCompleted) return;
    runCompleted = true;
    await completeSyncRun(runId, status, p, f);
  };

  log.step("runTestSync.start", {
    entityType,
    limit: TEST_SYNC_RECORD_LIMIT,
    siteId: mindbodyAccount.site_id,
  });

  try {
    log.step("ensureHubspotProperties.start");
    await ensureHubspotPropertiesForTenant(tenantId, hubspotAccount);
    await log.record("ensureHubspotProperties", "success");

    if (entityType === "contact") {
      if (!settings.contacts_enabled) {
        const msg = "Contact sync is disabled in settings";
        await log.record("contacts_enabled.check", "skipped", { message: msg });
        await finishRun("failed", 0, 1);
        throw new Error(msg);
      }

      await log.record("listMindbodyClients", "success", {
        message: `Fetching up to ${TEST_SYNC_RECORD_LIMIT} clients from Mindbody`,
      });

      let clients;
      try {
        clients = await listMindbodyClients(
          mindbodyAccount,
          0,
          TEST_SYNC_RECORD_LIMIT
        );
      } catch (e) {
        await log.fail("listMindbodyClients", e);
        await finishRun("failed", 0, 1);
        throw e;
      }

      await log.record("listMindbodyClients", "success", {
        message: `Fetched ${clients.length} clients`,
        detail: { returned: clients.length },
      });

      for (const client of clients) {
        const clientId = client.Id;
        log.step("syncContact.start", {
          clientId,
          email: client.Email ?? null,
        });

        try {
          const result = await syncContactMindbodyToHubspot(
            tenantId,
            hubspotAccount,
            mindbodyAccount,
            settings,
            clientId,
            runId
          );
          processed++;
          await log.record("syncContact", "success", {
            sourceId: clientId,
            targetId: result.hubspotId,
            detail: { email: client.Email },
          });
        } catch (e) {
          failed++;
          await log.fail("syncContact", e, clientId);
        }
      }
    }

    if (entityType === "deal") {
      if (!settings.deals_enabled) {
        const msg = "Deal sync is disabled in settings";
        await log.record("deals_enabled.check", "skipped", { message: msg });
        await finishRun("failed", 0, 1);
        throw new Error(msg);
      }

      const dealItems = await loadTestDealItems(
        mindbodyAccount,
        TEST_SYNC_RECORD_LIMIT,
        log,
        settings
      );

      if (dealItems.length === 0) {
        await log.record("loadTestDealItems", "skipped", {
          message:
            "No sales, contracts, or appointments found in Mindbody for test sync",
        });
      }

      for (const item of dealItems) {
        const externalId = String(
          item.kind === "sale"
            ? item.payload.saleId
            : item.kind === "contract"
              ? item.payload.clientContractId
              : item.payload.mindbody_appointment_id
        );

        log.step(`syncDeal.${item.kind}.start`, { externalId, payload: item.payload });

        try {
          const result =
            item.kind === "sale"
              ? await syncSaleToHubspotDeal(
                  tenantId,
                  hubspotAccount,
                  settings,
                  item.payload
                )
              : item.kind === "contract"
                ? await syncContractToHubspotDeal(
                    tenantId,
                    hubspotAccount,
                    mindbodyAccount,
                    settings,
                    item.payload
                  )
                : await syncAppointmentToHubspotDeal(
                    tenantId,
                    hubspotAccount,
                    settings,
                    item.payload
                  );

          processed++;
          await log.record(`syncDeal.${item.kind}`, "success", {
            sourceId: externalId,
            targetId: result.dealId,
          });
        } catch (e) {
          failed++;
          await log.fail(`syncDeal.${item.kind}`, e, externalId);
        }
      }
    }

    const status =
      failed > 0 ? (processed > 0 ? "partial" : "failed") : "completed";

    log.step("runTestSync.complete", { processed, failed, status });
    await finishRun(status, processed, failed);

    return runId;
  } catch (e) {
    if (!runCompleted) {
      await log.fail("runTestSync", e);
      await finishRun("failed", processed, Math.max(failed, 1));
    }
    throw e;
  }
}
