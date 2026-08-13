import { getSupabase } from "@/lib/db/client";
import type { WebhookSource } from "@/lib/db/types";
import type { QueueMessage } from "@/lib/queue/message";
import { processWebhookDelivery, runBackfill } from "@/lib/sync/processor";
import { runTestSync } from "@/lib/sync/test-sync";

type DeliveryRow = {
  id: string;
  tenant_id: string;
  source: WebhookSource;
  payload: unknown;
  status: string;
};

export class PermanentJobError extends Error {}

async function assertTenantRunnable(tenantId: string): Promise<"ok" | "skip"> {
  const { data, error } = await getSupabase()
    .from("tenants")
    .select("id, status")
    .eq("id", tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new PermanentJobError(`Tenant not found: ${tenantId}`);
  }
  if (data.status === "suspended") {
    return "skip";
  }
  return "ok";
}

async function loadDelivery(
  tenantId: string,
  deliveryId: string
): Promise<DeliveryRow> {
  const { data, error } = await getSupabase()
    .from("webhook_deliveries")
    .select("id, tenant_id, source, payload, status")
    .eq("id", deliveryId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Delivery ${deliveryId} not found for tenant ${tenantId}`
    );
  }
  return data as DeliveryRow;
}

/**
 * Run one SQS job for exactly one tenant. Credentials are loaded from
 * Supabase by tenantId inside the existing processors — never from the message.
 */
export async function processQueueMessage(
  message: QueueMessage
): Promise<void> {
  const tenantState = await assertTenantRunnable(message.tenantId);
  if (tenantState === "skip") {
    console.log(
      JSON.stringify({
        level: "info",
        msg: "queue_job_skipped_suspended",
        tenantId: message.tenantId,
        jobType: message.jobType,
        traceId: message.traceId,
      })
    );
    return;
  }

  switch (message.jobType) {
    case "process_webhook":
    case "replay_webhook": {
      if (!message.deliveryId) {
        throw new Error("deliveryId is required for webhook jobs");
      }
      const delivery = await loadDelivery(
        message.tenantId,
        message.deliveryId
      );
      if (
        message.jobType === "process_webhook" &&
        delivery.status === "processed"
      ) {
        console.log(
          JSON.stringify({
            level: "info",
            msg: "queue_job_already_processed",
            tenantId: message.tenantId,
            deliveryId: delivery.id,
            traceId: message.traceId,
          })
        );
        return;
      }
      await processWebhookDelivery({
        tenantId: message.tenantId,
        source: delivery.source,
        deliveryId: delivery.id,
        payload: delivery.payload,
      });
      return;
    }
    case "backfill": {
      if (!message.entityType) {
        throw new Error("entityType is required for backfill jobs");
      }
      await runBackfill(message.tenantId, message.entityType);
      return;
    }
    case "test_sync": {
      if (!message.entityType) {
        throw new Error("entityType is required for test_sync jobs");
      }
      await runTestSync(message.tenantId, message.entityType);
      return;
    }
    default: {
      const exhaustive: never = message.jobType;
      throw new Error(`Unknown jobType: ${String(exhaustive)}`);
    }
  }
}
