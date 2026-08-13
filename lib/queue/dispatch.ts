import type { EntityType, WebhookSource } from "@/lib/db/types";
import { getQueueConfig } from "@/lib/queue/config";
import { enqueueJob } from "@/lib/queue/sqs";

/**
 * Enqueue work for a tenant. When SQS_QUEUE_URL is set, send a tenant-stamped
 * SQS message (no secrets). Otherwise run inline in this process.
 */
export async function dispatchProcessWebhook(data: {
  tenantId: string;
  source: WebhookSource;
  deliveryId: string;
  payload: unknown;
}): Promise<void> {
  if (getQueueConfig().enabled) {
    await enqueueJob({
      tenantId: data.tenantId,
      jobType: "process_webhook",
      deliveryId: data.deliveryId,
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
  if (getQueueConfig().enabled) {
    await enqueueJob({
      tenantId,
      jobType: "backfill",
      entityType,
    });
    return;
  }

  const { runBackfill } = await import("@/lib/sync/processor");
  await runBackfill(tenantId, entityType);
}

export async function dispatchTestSync(
  tenantId: string,
  entityType: EntityType
): Promise<void> {
  if (getQueueConfig().enabled) {
    await enqueueJob({
      tenantId,
      jobType: "test_sync",
      entityType,
    });
    return;
  }

  const { runTestSync } = await import("@/lib/sync/test-sync");
  await runTestSync(tenantId, entityType);
}

export async function dispatchReplay(
  tenantId: string,
  deliveryId: string
): Promise<void> {
  const { getSupabase } = await import("@/lib/db/client");
  const { data: delivery, error } = await getSupabase()
    .from("webhook_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!delivery?.tenant_id) {
    throw new Error("Delivery not found");
  }

  if (getQueueConfig().enabled) {
    await enqueueJob({
      tenantId,
      jobType: "replay_webhook",
      deliveryId,
    });
    return;
  }

  const { processWebhookDelivery } = await import("@/lib/sync/processor");
  await processWebhookDelivery({
    tenantId: delivery.tenant_id,
    source: delivery.source,
    deliveryId: delivery.id,
    payload: delivery.payload,
  });
}
