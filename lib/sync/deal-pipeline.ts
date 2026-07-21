import type { MindbodyMappingSource } from "@/lib/db/types";
import type { SyncSettings } from "@/lib/db/types";
import { resolveMappedDealStage } from "@/lib/sync/deal-stage-mappings";

export type DealPipelineSource = MindbodyMappingSource;

function parseIsoDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function isoDateOnly(value: unknown): string | undefined {
  const date = parseIsoDate(value);
  if (!date) return undefined;
  return date.toISOString().slice(0, 10);
}

export type ResolvedDealPipeline = {
  properties: {
    pipeline?: string;
    dealstage?: string;
    closedate?: string;
  };
  stageWarning?: string;
};

export async function resolveDealPipelineProperties(
  _accessToken: string,
  settings: SyncSettings,
  source: DealPipelineSource,
  payload: Record<string, unknown>
): Promise<ResolvedDealPipeline> {
  const pipelineId = settings.deals_pipeline_id?.trim();
  if (!pipelineId) return { properties: {} };

  const mapped = resolveMappedDealStage(settings, source, payload);

  const closedate =
    source === "contract"
      ? isoDateOnly(payload.contractStartDateTime ?? payload.start_date)
      : source === "sale"
        ? isoDateOnly(
            payload.saleDateTime ??
              payload.originalSaleDateTime ??
              payload.purchase_datetime
          )
        : isoDateOnly(payload.start_datetime ?? payload.startDatetime);

  return {
    properties: {
      pipeline: pipelineId,
      ...(mapped.stageId ? { dealstage: mapped.stageId } : {}),
      ...(closedate ? { closedate } : {}),
    },
    stageWarning: mapped.stageWarning,
  };
}
