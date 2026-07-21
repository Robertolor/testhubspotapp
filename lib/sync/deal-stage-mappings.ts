import type { MindbodyMappingSource } from "@/lib/db/types";
import type { DealStageMappings, SyncSettings } from "@/lib/db/types";

/** Stable keys derived from Mindbody payload — tenants map these to HubSpot stage IDs. */
export type DealStageMappingKey =
  | "sale.completed"
  | "contract.upcoming"
  | "contract.active"
  | "contract.ended"
  | "appointment.scheduled"
  | "appointment.completed"
  | "appointment.no_show"
  | "appointment.cancelled"
  | "visit.attended"
  | "visit.missed"
  | "visit.cancelled";

export const DEAL_STAGE_MAPPING_KEYS: DealStageMappingKey[] = [
  "sale.completed",
  "contract.upcoming",
  "contract.active",
  "contract.ended",
  "appointment.scheduled",
  "appointment.completed",
  "appointment.no_show",
  "appointment.cancelled",
  "visit.attended",
  "visit.missed",
  "visit.cancelled",
];

export const DEAL_STAGE_MAPPING_CATALOG: {
  key: DealStageMappingKey;
  group: string;
  label: string;
  hint: string;
}[] = [
  {
    key: "sale.completed",
    group: "Sales",
    label: "Completed purchase",
    hint: "Mindbody sale / purchase",
  },
  {
    key: "contract.upcoming",
    group: "Contracts",
    label: "Upcoming",
    hint: "Contract has not started yet",
  },
  {
    key: "contract.active",
    group: "Contracts",
    label: "Active",
    hint: "Contract is currently active",
  },
  {
    key: "contract.ended",
    group: "Contracts",
    label: "Ended",
    hint: "Contract end date is in the past",
  },
  {
    key: "appointment.scheduled",
    group: "Appointments",
    label: "Scheduled",
    hint: "Booked or pending appointment",
  },
  {
    key: "appointment.completed",
    group: "Appointments",
    label: "Completed",
    hint: "Appointment completed or client arrived",
  },
  {
    key: "appointment.no_show",
    group: "Appointments",
    label: "No-show",
    hint: "Client missed the appointment",
  },
  {
    key: "appointment.cancelled",
    group: "Appointments",
    label: "Cancelled",
    hint: "Appointment was cancelled",
  },
  {
    key: "visit.attended",
    group: "Visits",
    label: "Attended",
    hint: "Client signed in or visit completed",
  },
  {
    key: "visit.missed",
    group: "Visits",
    label: "Missed / no-show",
    hint: "Visit was missed",
  },
  {
    key: "visit.cancelled",
    group: "Visits",
    label: "Cancelled",
    hint: "Visit was cancelled",
  },
];

const APPOINTMENT_SCHEDULED = new Set([
  "Scheduled",
  "Booked",
  "Confirmed",
  "Pending",
]);

const APPOINTMENT_COMPLETED = new Set(["Completed", "Arrived"]);

const APPOINTMENT_NO_SHOW = new Set([
  "NoShow",
  "No Show",
  "No-show",
  "Missed",
]);

const APPOINTMENT_CANCELLED = new Set([
  "Cancelled",
  "Canceled",
  "LateCancelled",
  "Late Cancelled",
]);

function parseIsoDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function deriveContractStageKey(
  payload: Record<string, unknown>
): DealStageMappingKey {
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
    if (startDay > today) return "contract.upcoming";
  }
  if (end) {
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    if (endDay < today) return "contract.ended";
  }
  return "contract.active";
}

function appointmentStageKey(
  payload: Record<string, unknown>
): DealStageMappingKey {
  const candidates = [
    payload.derived_stage != null ? String(payload.derived_stage).trim() : "",
    payload.status_raw != null ? String(payload.status_raw).trim() : "",
  ].filter(Boolean);

  for (const status of candidates) {
    if (APPOINTMENT_CANCELLED.has(status)) return "appointment.cancelled";
    if (APPOINTMENT_NO_SHOW.has(status)) return "appointment.no_show";
    if (APPOINTMENT_COMPLETED.has(status)) return "appointment.completed";
    if (APPOINTMENT_SCHEDULED.has(status)) return "appointment.scheduled";
  }

  return "appointment.scheduled";
}

function visitStageKey(payload: Record<string, unknown>): DealStageMappingKey {
  const derived = String(payload.derived_stage ?? "Attended").trim();
  if (derived === "Cancelled") return "visit.cancelled";
  if (derived === "Missed / No-show") return "visit.missed";
  return "visit.attended";
}

export function logicalStageKeyForDealSource(
  source: MindbodyMappingSource,
  payload: Record<string, unknown>
): DealStageMappingKey {
  switch (source) {
    case "sale":
      return "sale.completed";
    case "contract":
      return deriveContractStageKey(payload);
    case "appointment":
      return appointmentStageKey(payload);
    case "visit":
      return visitStageKey(payload);
  }
}

export function labelForDealStageMappingKey(key: DealStageMappingKey): string {
  return (
    DEAL_STAGE_MAPPING_CATALOG.find((entry) => entry.key === key)?.label ?? key
  );
}

export function normalizeDealStageMappings(value: unknown): DealStageMappings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const raw = value as Record<string, unknown>;
  const out: DealStageMappings = {};

  for (const key of DEAL_STAGE_MAPPING_KEYS) {
    const stageId = raw[key];
    if (stageId != null && String(stageId).trim()) {
      out[key] = String(stageId).trim();
    }
  }

  return out;
}

export function resolveMappedDealStage(
  settings: SyncSettings,
  source: MindbodyMappingSource,
  payload: Record<string, unknown>
): {
  logicalKey: DealStageMappingKey;
  stageId?: string;
  stageWarning?: string;
} {
  const logicalKey = logicalStageKeyForDealSource(source, payload);
  const stageId = settings.deal_stage_mappings[logicalKey];

  if (!stageId) {
    return {
      logicalKey,
      stageWarning: `No pipeline stage mapping configured for ${labelForDealStageMappingKey(logicalKey)} (${logicalKey})`,
    };
  }

  return { logicalKey, stageId };
}
