/**
 * Normalize Mindbody ClientVisits rows into mapping-catalog keys
 * (aligned with Gritcity + lib/mindbody/deal-field-catalog visit fields).
 */

function strId(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

const CANCELLED = new Set([
  "Cancelled",
  "Canceled",
  "LateCancelled",
  "Late Cancelled",
]);

function deriveVisitStage(row: Record<string, unknown>): string {
  const statusRaw = row.AppointmentStatus != null ? String(row.AppointmentStatus).trim() : "";
  if (row.LateCancelled === true || CANCELLED.has(statusRaw)) return "Cancelled";
  if (row.Missed === true) return "Missed / No-show";
  if (row.SignedIn === true) return "Attended";
  if (statusRaw === "Completed") return "Attended";
  return "Missed / No-show";
}

function programFromRow(row: Record<string, unknown>): {
  id: string | null;
  name: string | null;
  scheduleType: string | null;
} {
  const service = row.Service;
  if (!service || typeof service !== "object") {
    return { id: null, name: null, scheduleType: null };
  }
  const program = (service as Record<string, unknown>).Program;
  if (!program || typeof program !== "object") {
    return { id: null, name: null, scheduleType: null };
  }
  const p = program as Record<string, unknown>;
  return {
    id: strId(p.Id) || null,
    name: p.Name != null ? String(p.Name) : null,
    scheduleType: p.ScheduleType != null ? String(p.ScheduleType) : null,
  };
}

/** Stable identity when Mindbody visit Id is missing/0. */
export function visitIdentityKey(
  row: Record<string, unknown>,
  sourceClientId: string
): string {
  const visitId = strId(row.Id);
  if (visitId && visitId !== "0") return visitId;
  const start = row.StartDateTime ? String(row.StartDateTime) : "unknown";
  const name = row.Name != null ? String(row.Name) : "visit";
  return `${sourceClientId}:${start}:${name}`;
}

/** Map raw Mindbody visit → payload for applyDealMappings(..., "visit"). */
export function normalizeVisitPayload(
  row: Record<string, unknown>,
  sourceClientId: string
): Record<string, unknown> {
  const visitKey = visitIdentityKey(row, sourceClientId);
  const start = row.StartDateTime ? String(row.StartDateTime) : null;
  const end = row.EndDateTime ? String(row.EndDateTime) : null;
  const visitName = row.Name != null ? String(row.Name) : "Visit";
  const program = programFromRow(row);
  const statusRaw =
    row.AppointmentStatus != null ? String(row.AppointmentStatus) : null;
  const derivedStage = deriveVisitStage(row);
  const staffId = strId(row.StaffId) || null;

  const dealName = start
    ? `Visit | ${sourceClientId || "Client"} | ${visitName} | ${start.slice(0, 16).replace("T", " ")}`
    : `Visit | ${sourceClientId || "Client"} | ${visitName}`;

  return {
    mindbody_visit_id: visitKey,
    record_key: `visit:${visitKey}`,
    source_client_id: sourceClientId || null,
    start_datetime: start,
    end_datetime: end,
    visit_name: visitName,
    service_name: row.ServiceName != null ? String(row.ServiceName) : null,
    status_raw: statusRaw,
    derived_stage: derivedStage,
    program_id: program.id,
    program_name: program.name,
    schedule_type: program.scheduleType,
    staff_id: staffId,
    staff_name: null,
    deal_name: dealName,
    deal_source: "mindbody_visit",
  };
}
