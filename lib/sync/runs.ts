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
  entityType?: EntityType,
  metadata?: Record<string, unknown>
): Promise<string> {
  const { data, error } = await getSupabase()
    .from("sync_runs")
    .insert({
      tenant_id: tenantId,
      trigger_source: triggerSource,
      entity_type: entityType ?? null,
      status: "running",
      metadata: metadata ?? {},
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function updateSyncRunProgress(
  runId: string,
  processed: number,
  failed: number
): Promise<void> {
  await getSupabase()
    .from("sync_runs")
    .update({
      records_processed: processed,
      records_failed: failed,
    })
    .eq("id", runId)
    .eq("status", "running");
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

/** Close runs left "running" after the worker was killed (Vercel timeout, crash). */
export async function reconcileStaleSyncRuns(
  tenantId: string,
  olderThanMs = 2 * 60 * 1000
): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  const { data: stale } = await getSupabase()
    .from("sync_runs")
    .select("id, entity_type")
    .eq("tenant_id", tenantId)
    .eq("status", "running")
    .lt("started_at", cutoff);

  if (!stale?.length) return 0;

  let closed = 0;
  for (const run of stale) {
    const { data: events } = await getSupabase()
      .from("sync_events")
      .select("status, message, source_id")
      .eq("sync_run_id", run.id);

    const { count: errorCount } = await getSupabase()
      .from("sync_errors")
      .select("id", { count: "exact", head: true })
      .eq("sync_run_id", run.id);

    const list = events ?? [];
    const processed = list.filter(
      (e) =>
        e.status === "success" &&
        e.source_id &&
        (e.message === "created" || e.message === "updated")
    ).length;
    const failedFromEvents = list.filter((e) => e.status === "failed").length;
    const failed = Math.max(failedFromEvents, errorCount ?? 0);

    const status: SyncRunStatus =
      failed > 0
        ? processed > 0
          ? "partial"
          : "failed"
        : processed > 0
          ? "completed"
          : "failed";

    const { data: updated } = await getSupabase()
      .from("sync_runs")
      .update({
        status,
        records_processed: processed,
        records_failed: failed,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .eq("status", "running")
      .select("id")
      .maybeSingle();

    if (!updated) continue;

    const entityType = (run.entity_type as EntityType | null) ?? "contact";
    await logSyncEvent(
      run.id,
      tenantId,
      entityType,
      "system",
      "skipped",
      "Run interrupted before completion (server timeout or crash); status reconciled from events"
    );
    closed++;
  }

  return closed;
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
