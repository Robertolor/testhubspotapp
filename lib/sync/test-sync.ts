import { getHubspotAccountByTenant } from "@/lib/hubspot/tokens";
import {
  fetchClientContracts,
  getMindbodyAccountByTenant,
  listMindbodyClientVisits,
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
  syncVisitToHubspotDeal,
} from "@/lib/sync/deals";
import { normalizeAppointmentPayload } from "@/lib/sync/appointments";
import { normalizeVisitPayload } from "@/lib/sync/visits";
import { ensureHubspotPropertiesForTenant } from "@/lib/sync/ensure-hubspot-properties";
import {
  completeSyncRun,
  createSyncRun,
} from "@/lib/sync/runs";
import { normalizeSyncSettings } from "@/lib/sync/runtime-rules";
import { TestSyncLogger } from "@/lib/sync/test-logger";

/** TEMP: sandbox E2E cap — remove or gate behind env before production */
export const TEST_SYNC_RECORD_LIMIT = 20;

const APPOINTMENT_LOOKBACK_DAYS = 30;
/** Class visits are often older than appointments; Gritcity pulls from 2000. */
const VISIT_LOOKBACK_DAYS = 365;
const VISIT_CLIENT_SCAN_LIMIT = 50;

type DealTestItem =
  | { kind: "sale"; payload: Record<string, unknown> }
  | { kind: "contract"; payload: Record<string, unknown> }
  | { kind: "appointment"; payload: Record<string, unknown> }
  | { kind: "visit"; payload: Record<string, unknown> };

type TestDealBudget = {
  coreMax: number;
  appointmentMax: number;
  visitMax: number;
};

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

/** Reserve slots so enabled optional types are not crowded out by sales/contracts. */
function computeTestDealBudget(
  limit: number,
  settings: SyncSettings
): TestDealBudget {
  const wantsAppointments = settings.appointments_enabled;
  const wantsVisits = settings.visits_enabled;
  const optionalCount = (wantsAppointments ? 1 : 0) + (wantsVisits ? 1 : 0);

  if (optionalCount === 0) {
    return { coreMax: limit, appointmentMax: 0, visitMax: 0 };
  }

  const reservedEach =
    optionalCount === 1
      ? Math.min(10, Math.floor(limit / 2))
      : Math.min(6, Math.floor(limit / (optionalCount + 2)));

  const optionalTotal = reservedEach * optionalCount;
  return {
    coreMax: Math.max(limit - optionalTotal, 0),
    appointmentMax: wantsAppointments ? reservedEach : 0,
    visitMax: wantsVisits ? reservedEach : 0,
  };
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
  const budget = computeTestDealBudget(limit, settings);

  log.step("loadTestDealItems.start", { limit, budget });

  const sales = await listMindbodySales(
    mindbodyAccount,
    0,
    Math.min(limit, budget.coreMax)
  );
  log.step("listMindbodySales.done", { returned: sales.length });

  for (const sale of sales) {
    const payload = normalizeSalePayload(sale as Record<string, unknown>);
    if (!payload.saleId) continue;
    items.push({ kind: "sale", payload });
    if (items.length >= budget.coreMax) break;
  }

  log.step("loadTestDealItems.scanContracts", {
    salesFound: items.length,
    coreMax: budget.coreMax,
  });

  const clients = await listMindbodyClients(mindbodyAccount, 0, 10);
  log.step("listMindbodyClients.forContracts", { clientCount: clients.length });

  for (const client of clients) {
    if (items.length >= budget.coreMax) break;

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
      if (items.length >= budget.coreMax) break;
    }
  }

  if (settings.appointments_enabled && budget.appointmentMax > 0) {
    const startDate = isoDateDaysAgo(APPOINTMENT_LOOKBACK_DAYS);
    const endDate = isoDateDaysAgo(0);
    const appointmentSlots = Math.min(
      budget.appointmentMax,
      limit - items.length
    );

    log.step("listMindbodyStaffAppointments.start", {
      startDate,
      endDate,
      appointmentSlots,
    });

    const appointments = await listMindbodyStaffAppointments(mindbodyAccount, {
      startDate,
      endDate,
      offset: 0,
      limit: appointmentSlots,
    });
    log.step("listMindbodyStaffAppointments.done", {
      returned: appointments.length,
    });

    for (const row of appointments) {
      const payload = normalizeAppointmentPayload(row);
      if (!payload.mindbody_appointment_id) continue;
      items.push({ kind: "appointment", payload });
      if (items.filter((item) => item.kind === "appointment").length >= appointmentSlots) {
        break;
      }
    }
  }

  if (settings.visits_enabled && budget.visitMax > 0) {
    const startDate = isoDateDaysAgo(VISIT_LOOKBACK_DAYS);
    const endDate = isoDateDaysAgo(0);
    const visitSlots = Math.min(budget.visitMax, limit - items.length);

    log.step("listMindbodyClientVisits.start", {
      startDate,
      endDate,
      visitSlots,
      clientScanLimit: VISIT_CLIENT_SCAN_LIMIT,
    });

    const visitClients = await listMindbodyClients(
      mindbodyAccount,
      0,
      VISIT_CLIENT_SCAN_LIMIT
    );
    let visitCount = 0;
    let clientsWithVisits = 0;

    for (const client of visitClients) {
      if (visitCount >= visitSlots) break;
      const clientId = client.Id;
      if (!clientId) continue;

      let visits: Record<string, unknown>[] = [];
      try {
        visits = await listMindbodyClientVisits(mindbodyAccount, {
          clientId,
          startDate,
          endDate,
          offset: 0,
          limit: visitSlots - visitCount,
        });
      } catch (e) {
        log.step("listMindbodyClientVisits.clientFailed", {
          clientId,
          error: e instanceof Error ? e.message : String(e),
        });
        continue;
      }

      if (visits.length > 0) {
        clientsWithVisits++;
        log.step("listMindbodyClientVisits.client", {
          clientId,
          returned: visits.length,
        });
      }

      for (const row of visits) {
        const payload = normalizeVisitPayload(row, clientId);
        if (!payload.mindbody_visit_id) continue;
        items.push({ kind: "visit", payload });
        visitCount++;
        if (visitCount >= visitSlots) break;
      }
    }

    log.step("listMindbodyClientVisits.done", {
      clientsChecked: visitClients.length,
      clientsWithVisits,
      returned: visitCount,
    });
  }

  const counts = items.reduce(
    (acc, item) => {
      acc[item.kind] = (acc[item.kind] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );
  log.step("loadTestDealItems.done", { total: items.length, counts });
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
            message: result.action,
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
            "No sales, contracts, appointments, or visits found in Mindbody for test sync",
        });
      }

      for (const item of dealItems) {
        const externalId = String(
          item.kind === "sale"
            ? item.payload.saleId
            : item.kind === "contract"
              ? item.payload.clientContractId
              : item.kind === "appointment"
                ? item.payload.mindbody_appointment_id
                : item.payload.mindbody_visit_id
        );

        log.step(`syncDeal.${item.kind}.start`, { externalId, payload: item.payload });

        try {
          const result =
            item.kind === "sale"
              ? await syncSaleToHubspotDeal(
                  tenantId,
                  hubspotAccount,
                  settings,
                  item.payload,
                  mindbodyAccount
                )
              : item.kind === "contract"
                ? await syncContractToHubspotDeal(
                    tenantId,
                    hubspotAccount,
                    mindbodyAccount,
                    settings,
                    item.payload
                  )
                : item.kind === "appointment"
                  ? await syncAppointmentToHubspotDeal(
                      tenantId,
                      hubspotAccount,
                      settings,
                      item.payload
                    )
                  : await syncVisitToHubspotDeal(
                      tenantId,
                      hubspotAccount,
                      settings,
                      item.payload
                    );

          processed++;
          await log.record(`syncDeal.${item.kind}`, "success", {
            sourceId: externalId,
            targetId: result.dealId,
            message: result.action,
          });

          if (result.lineItems?.length) {
            for (const lineItem of result.lineItems) {
              processed++;
              await log.record("syncLineItem", "success", {
                sourceId: lineItem.lineItemKey,
                targetId: lineItem.hubspotId,
                message: lineItem.action,
              });
            }
          }
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
