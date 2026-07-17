/**
 * Normalize Mindbody StaffAppointments rows into mapping-catalog keys
 * (aligned with Gritcity + lib/mindbody/deal-field-catalog appointment fields).
 */

function strId(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function staffNameFromRow(row: Record<string, unknown>): string | null {
  const staff = row.Staff;
  if (!staff || typeof staff !== "object") return null;
  const s = staff as Record<string, unknown>;
  const name = [s.FirstName, s.LastName].filter(Boolean).join(" ").trim();
  return name || null;
}

function resourceLists(row: Record<string, unknown>): {
  ids: string[];
  names: string[];
} {
  const resources = row.Resources;
  const ids: string[] = [];
  const names: string[] = [];
  if (!Array.isArray(resources)) return { ids, names };
  for (const resource of resources) {
    if (!resource || typeof resource !== "object") continue;
    const r = resource as Record<string, unknown>;
    if (r.Id != null) ids.push(String(r.Id));
    if (r.Name) names.push(String(r.Name));
  }
  return { ids, names };
}

function appointmentNameFromRow(row: Record<string, unknown>): string {
  const sessionTypeId = strId(row.SessionTypeId);
  if (sessionTypeId) return `Session Type ${sessionTypeId}`;
  return "Appointment";
}

/** Map raw Mindbody appointment → payload for applyDealMappings(..., "appointment"). */
export function normalizeAppointmentPayload(
  row: Record<string, unknown>
): Record<string, unknown> {
  const appointmentId = strId(row.Id);
  const clientRef = strId(row.ClientId);
  const start = row.StartDateTime ? String(row.StartDateTime) : null;
  const end = row.EndDateTime ? String(row.EndDateTime) : null;
  const appointmentName = appointmentNameFromRow(row);
  const staffId = strId(row.StaffId) || null;
  const staffName = staffNameFromRow(row);
  const { ids: resourceIds, names: resourceNames } = resourceLists(row);
  const statusRaw = row.Status != null ? String(row.Status) : null;

  const dealName = start
    ? `Appointment | ${clientRef || "Client"} | ${appointmentName} | ${start.slice(0, 16).replace("T", " ")}`
    : `Appointment | ${clientRef || "Client"} | ${appointmentName}`;

  return {
    mindbody_appointment_id: appointmentId,
    record_key: appointmentId ? `appointment:${appointmentId}` : null,
    source_client_reference: clientRef || null,
    resolved_contact_client_id: clientRef || null,
    status_raw: statusRaw,
    derived_stage: statusRaw || "Scheduled",
    start_datetime: start,
    end_datetime: end,
    session_type_id: strId(row.SessionTypeId) || null,
    appointment_name: appointmentName,
    staff_id: staffId,
    staff_name: staffName,
    resource_ids: resourceIds.join(";"),
    resource_names: resourceNames.join("; "),
    deal_name: dealName,
    deal_source: "mindbody_appointment",
  };
}
