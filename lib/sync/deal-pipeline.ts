import type { MindbodyMappingSource } from "@/lib/db/types";
import type { SyncSettings } from "@/lib/db/types";
import type { HubspotDealPipeline } from "@/lib/hubspot/pipelines";
import { getDealPipelineById } from "@/lib/hubspot/pipelines";

export type DealPipelineSource = MindbodyMappingSource;

const APPOINTMENT_STATUS_TO_STAGE: Record<string, string> = {
  Scheduled: "Scheduled",
  Booked: "Scheduled",
  Confirmed: "Scheduled",
  Pending: "Scheduled",
  Completed: "Completed",
  Arrived: "Completed",
  NoShow: "No-show",
  "No Show": "No-show",
  "No-show": "No-show",
  Missed: "No-show",
  Cancelled: "Cancelled",
  Canceled: "Cancelled",
  LateCancelled: "Cancelled",
  "Late Cancelled": "Cancelled",
};

const pipelineCache = new Map<
  string,
  { expiresAt: number; pipeline: HubspotDealPipeline }
>();

const CACHE_TTL_MS = 60_000;

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

export function deriveContractStage(payload: Record<string, unknown>): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = parseIsoDate(
    payload.contractStartDateTime ?? payload.start_date ?? payload.StartDate
  );
  const end = parseIsoDate(
    payload.contractEndDateTime ?? payload.end_date ?? payload.EndDate
  );

  if (start) {
    const startDay = new Date(start);
    startDay.setHours(0, 0, 0, 0);
    if (startDay > today) return "Upcoming";
  }
  if (end) {
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    if (endDay < today) return "Ended";
  }
  return "Active";
}

function appointmentStageLabel(payload: Record<string, unknown>): string {
  const derived = payload.derived_stage != null ? String(payload.derived_stage).trim() : "";
  if (derived && APPOINTMENT_STATUS_TO_STAGE[derived]) {
    return APPOINTMENT_STATUS_TO_STAGE[derived];
  }
  const statusRaw = payload.status_raw != null ? String(payload.status_raw).trim() : "";
  if (statusRaw && APPOINTMENT_STATUS_TO_STAGE[statusRaw]) {
    return APPOINTMENT_STATUS_TO_STAGE[statusRaw];
  }
  if (derived) return derived;
  if (statusRaw) return statusRaw;
  return "Scheduled";
}

export function stageLabelForDealSource(
  source: DealPipelineSource,
  payload: Record<string, unknown>
): string {
  switch (source) {
    case "sale":
      return "Completed Purchase";
    case "contract":
      return deriveContractStage(payload);
    case "appointment":
      return appointmentStageLabel(payload);
    case "visit":
      return String(payload.derived_stage ?? "Attended");
  }
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}

function findStageId(
  pipeline: HubspotDealPipeline,
  stageLabel: string
): string | undefined {
  const target = normalizeLabel(stageLabel);
  const exact = pipeline.stages.find(
    (stage) => normalizeLabel(stage.label) === target
  );
  if (exact) return exact.id;

  const partial = pipeline.stages.find((stage) => {
    const label = normalizeLabel(stage.label);
    return label.includes(target) || target.includes(label);
  });
  return partial?.id ?? pipeline.stages[0]?.id;
}

async function loadPipeline(
  accessToken: string,
  pipelineId: string
): Promise<HubspotDealPipeline | null> {
  const cached = pipelineCache.get(pipelineId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.pipeline;
  }

  const pipeline = await getDealPipelineById(accessToken, pipelineId);
  if (pipeline) {
    pipelineCache.set(pipelineId, {
      pipeline,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
  return pipeline;
}

export async function resolveDealPipelineProperties(
  accessToken: string,
  settings: SyncSettings,
  source: DealPipelineSource,
  payload: Record<string, unknown>
): Promise<{ pipeline?: string; dealstage?: string; closedate?: string }> {
  const pipelineId = settings.deals_pipeline_id?.trim();
  if (!pipelineId) return {};

  const pipeline = await loadPipeline(accessToken, pipelineId);
  if (!pipeline || pipeline.stages.length === 0) return { pipeline: pipelineId };

  const stageLabel = stageLabelForDealSource(source, payload);
  const dealstage = findStageId(pipeline, stageLabel);

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
    pipeline: pipelineId,
    ...(dealstage ? { dealstage } : {}),
    ...(closedate ? { closedate } : {}),
  };
}
