import { inngest } from "@/lib/inngest/client";
import type { WebhookSource } from "@/lib/db/types";
import type { EntityType } from "@/lib/db/types";

/** Enqueue webhook processing; falls back to inline when Inngest is not configured */
export async function dispatchProcessWebhook(data: {
  tenantId: string;
  source: WebhookSource;
  deliveryId: string;
  payload: unknown;
}): Promise<void> {
  if (process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY) {
    await inngest.send({
      name: "sync/process-webhook",
      data,
    });
    return;
  }

  const { processWebhookDelivery } = await import("@/lib/sync/processor");
  await processWebhookDelivery({
    tenantId: data.tenantId,
    source: data.source,
    deliveryId: data.deliveryId,
    payload: data.payload,
  });
}

export async function dispatchBackfill(
  tenantId: string,
  entityType: EntityType
): Promise<void> {
  const eventName =
    entityType === "contact"
      ? "sync/backfill-contacts"
      : "sync/backfill-deals";

  if (process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY) {
    await inngest.send({ name: eventName, data: { tenantId } });
    return;
  }

  const { runBackfill } = await import("@/lib/sync/processor");
  await runBackfill(tenantId, entityType);
}

export async function dispatchTestSync(
  tenantId: string,
  entityType: EntityType
): Promise<void> {
  const eventName =
    entityType === "contact"
      ? "sync/test-contacts"
      : "sync/test-deals";

  if (process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY) {
    await inngest.send({ name: eventName, data: { tenantId } });
    return;
  }

  const { runTestSync } = await import("@/lib/sync/test-sync");
  await runTestSync(tenantId, entityType);
}

export async function dispatchReplay(deliveryId: string): Promise<void> {
  if (process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY) {
    await inngest.send({
      name: "sync/replay-webhook",
      data: { deliveryId },
    });
    return;
  }

  const { getSupabase } = await import("@/lib/db/client");
  const { processWebhookDelivery } = await import("@/lib/sync/processor");
  const { data: delivery } = await getSupabase()
    .from("webhook_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .single();

  if (!delivery?.tenant_id) throw new Error("Delivery not found");

  await processWebhookDelivery({
    tenantId: delivery.tenant_id,
    source: delivery.source,
    deliveryId: delivery.id,
    payload: delivery.payload,
  });
}
