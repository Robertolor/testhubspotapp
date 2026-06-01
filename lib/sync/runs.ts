import { getSupabase } from "@/lib/db/client";
import type {
  EntityType,
  SyncEventStatus,
  SyncRunStatus,
  SyncSource,
  WebhookSource,
} from "@/lib/db/types";

export async function createSyncRun(
  tenantId: string,
  triggerSource: SyncSource,
  entityType?: EntityType
): Promise<string> {
  const { data, error } = await getSupabase()
    .from("sync_runs")
    .insert({
      tenant_id: tenantId,
      trigger_source: triggerSource,
      entity_type: entityType ?? null,
      status: "running",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function completeSyncRun(
  runId: string,
  status: SyncRunStatus,
  processed: number,
  failed: number
): Promise<void> {
  await getSupabase()
    .from("sync_runs")
    .update({
      status,
      records_processed: processed,
      records_failed: failed,
      completed_at: new Date().toISOString(),
    })
    .eq("id", runId);
}

export async function logSyncEvent(
  runId: string,
  tenantId: string,
  entityType: EntityType,
  direction: string,
  status: SyncEventStatus,
  message?: string,
  sourceId?: string,
  targetId?: string
): Promise<void> {
  await getSupabase().from("sync_events").insert({
    sync_run_id: runId,
    tenant_id: tenantId,
    entity_type: entityType,
    direction,
    status,
    message: message ?? null,
    source_id: sourceId ?? null,
    target_id: targetId ?? null,
  });
}

export async function logSyncError(
  tenantId: string,
  message: string,
  opts?: {
    syncRunId?: string;
    entityType?: EntityType;
    source?: WebhookSource;
    externalId?: string;
    errorCode?: string;
  }
): Promise<void> {
  await getSupabase().from("sync_errors").insert({
    tenant_id: tenantId,
    sync_run_id: opts?.syncRunId ?? null,
    entity_type: opts?.entityType ?? null,
    source: opts?.source ?? null,
    external_id: opts?.externalId ?? null,
    error_code: opts?.errorCode ?? null,
    message,
  });
}
