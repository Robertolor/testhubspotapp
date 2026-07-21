import type { EntityType, SyncEventStatus } from "@/lib/db/types";
import { logSyncError, logSyncEvent } from "@/lib/sync/runs";

/** TEMP: structured logging for sandbox test sync — remove when full backfill is production-ready */
export class TestSyncLogger {
  constructor(
    private readonly tenantId: string,
    private readonly runId: string,
    private readonly entityType: EntityType
  ) {}

  step(phase: string, detail?: Record<string, unknown>): void {
    const suffix = detail ? ` ${JSON.stringify(detail)}` : "";
    console.log(
      `[test-sync] tenant=${this.tenantId} run=${this.runId} entity=${this.entityType} phase=${phase}${suffix}`
    );
  }

  async record(
    phase: string,
    status: SyncEventStatus,
    opts?: {
      message?: string;
      sourceId?: string;
      targetId?: string;
      entityType?: EntityType;
      detail?: Record<string, unknown>;
    }
  ): Promise<void> {
    const message =
      opts?.message ??
      (opts?.detail ? `${phase}: ${JSON.stringify(opts.detail)}` : phase);

    this.step(phase, { status, ...opts?.detail, sourceId: opts?.sourceId, targetId: opts?.targetId });

    await logSyncEvent(
      this.runId,
      this.tenantId,
      opts?.entityType ?? this.entityType,
      "mb_to_hs",
      status,
      message,
      opts?.sourceId,
      opts?.targetId
    );
  }

  async fail(
    phase: string,
    error: unknown,
    externalId?: string
  ): Promise<void> {
    const message = error instanceof Error ? error.message : String(error);
    this.step(phase, { status: "failed", error: message, externalId });
    await logSyncError(this.tenantId, `[${phase}] ${message}`, {
      syncRunId: this.runId,
      entityType: this.entityType,
      externalId,
      errorCode: "test_sync",
    });
  }
}
