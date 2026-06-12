import { inngest } from "@/lib/inngest/client";
import { processWebhookDelivery, runBackfill } from "@/lib/sync/processor";
import { runTestSync } from "@/lib/sync/test-sync";
import { getSupabase } from "@/lib/db/client";
import type { EntityType } from "@/lib/db/types";

export const processWebhook = inngest.createFunction(
  {
    id: "sync-process-webhook",
    retries: 3,
    triggers: [{ event: "sync/process-webhook" }],
  },
  async ({ event }) => {
    await processWebhookDelivery({
      tenantId: event.data.tenantId as string,
      source: event.data.source as "hubspot" | "mindbody",
      deliveryId: event.data.deliveryId as string,
      payload: event.data.payload,
    });
  }
);

export const backfillContacts = inngest.createFunction(
  {
    id: "sync-backfill-contacts",
    retries: 2,
    triggers: [{ event: "sync/backfill-contacts" }],
  },
  async ({ event }) => {
    await runBackfill(event.data.tenantId as string, "contact");
  }
);

export const backfillDeals = inngest.createFunction(
  {
    id: "sync-backfill-deals",
    retries: 2,
    triggers: [{ event: "sync/backfill-deals" }],
  },
  async ({ event }) => {
    await runBackfill(event.data.tenantId as string, "deal");
  }
);

export const testSyncContacts = inngest.createFunction(
  {
    id: "sync-test-contacts",
    retries: 1,
    triggers: [{ event: "sync/test-contacts" }],
  },
  async ({ event }) => {
    await runTestSync(event.data.tenantId as string, "contact");
  }
);

export const testSyncDeals = inngest.createFunction(
  {
    id: "sync-test-deals",
    retries: 1,
    triggers: [{ event: "sync/test-deals" }],
  },
  async ({ event }) => {
    await runTestSync(event.data.tenantId as string, "deal");
  }
);

export const replayWebhook = inngest.createFunction(
  {
    id: "sync-replay-webhook",
    retries: 2,
    triggers: [{ event: "sync/replay-webhook" }],
  },
  async ({ event }) => {
    const { data: delivery, error } = await getSupabase()
      .from("webhook_deliveries")
      .select("*")
      .eq("id", event.data.deliveryId as string)
      .single();

    if (error || !delivery) {
      throw new Error("Webhook delivery not found");
    }

    if (!delivery.tenant_id) {
      throw new Error("Delivery has no tenant");
    }

    await processWebhookDelivery({
      tenantId: delivery.tenant_id,
      source: delivery.source,
      deliveryId: delivery.id,
      payload: delivery.payload,
    });
  }
);

export const inngestFunctions = [
  processWebhook,
  backfillContacts,
  backfillDeals,
  testSyncContacts,
  testSyncDeals,
  replayWebhook,
];

export type BackfillEntity = EntityType;
