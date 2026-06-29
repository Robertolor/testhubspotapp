type NormalizedFieldType =
  | "string"
  | "number"
  | "boolean"
  | "datetime"
  | "enumeration"
  | "unknown";

const CUSTOM_FIELD_KEY = /^custom:(\d+)$/i;

function normalizeHubspotType(type: string | null | undefined): NormalizedFieldType {
  const value = (type ?? "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "enumeration") return "enumeration";
  if (value === "bool" || value === "boolean") return "boolean";
  if (value === "datetime" || value === "date") return "datetime";
  if (value === "number") return "number";
  if (value === "string" || value === "text" || value === "phone") return "string";
  return "unknown";
}

function normalizeMindbodyType(type: string | null | undefined): NormalizedFieldType {
  const value = (type ?? "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "boolean" || value === "bool") return "boolean";
  if (value.includes("date") || value.includes("time")) return "datetime";
  if (
    value === "number" ||
    value.includes("double") ||
    value.includes("int") ||
    value.includes("float") ||
    value.includes("decimal")
  ) {
    return "number";
  }
  if (value === "string" || value === "text") return "string";
  return "unknown";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractCustomClientField(
  record: Record<string, unknown>,
  fieldId: number
): unknown {
  const fields = record.CustomClientFields;
  if (!Array.isArray(fields)) return undefined;

  for (const item of fields) {
    if (!isRecord(item)) continue;
    if (Number(item.Id) === fieldId) {
      return item.Value;
    }
  }

  return undefined;
}

function extractNestedPath(
  record: Record<string, unknown>,
  path: string
): unknown {
  const parts = path.split(".").filter(Boolean);
  let current: unknown = record;

  for (const part of parts) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }

  return current;
}

/** Read a Mindbody client value by catalog key (flat, nested, or custom:{id}). */
export function extractMindbodyValue(
  record: Record<string, unknown>,
  fieldKey: string
): unknown {
  const key = fieldKey.trim();
  if (!key) return undefined;

  const customMatch = CUSTOM_FIELD_KEY.exec(key);
  if (customMatch) {
    return extractCustomClientField(record, Number(customMatch[1]));
  }

  if (key.includes(".")) {
    return extractNestedPath(record, key);
  }

  return record[key];
}

function parseToDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function formatAsString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (isRecord(value) || Array.isArray(value)) {
    return null;
  }
  return String(value);
}

function formatAsNumber(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return null;
    return String(parsed);
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  return null;
}

function formatAsBoolean(value: unknown): string | null {
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (typeof value === "number") {
    if (value === 1) return "true";
    if (value === 0) return "false";
    return null;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return "true";
    if (["false", "0", "no", "n"].includes(normalized)) return "false";
  }
  return null;
}

function formatAsDatetime(value: unknown): string | null {
  const date = parseToDate(value);
  if (!date) return null;
  return date.toISOString();
}

/**
 * Format an extracted Mindbody value for a HubSpot property.
 * Returns null when the value cannot be represented for the target type.
 */
export function formatForHubspot(
  value: unknown,
  hubspotType: string | null | undefined,
  mindbodyType: string | null | undefined
): string | null {
  if (value === undefined || value === null) return null;

  const hs = normalizeHubspotType(hubspotType);
  const mb = normalizeMindbodyType(mindbodyType);

  switch (hs) {
    case "string":
      return formatAsString(value);
    case "enumeration":
      if (mb === "number" || mb === "boolean") {
        return formatAsString(value);
      }
      return formatAsString(value);
    case "number":
      return formatAsNumber(value);
    case "boolean":
      return formatAsBoolean(value);
    case "datetime":
      return formatAsDatetime(value);
    case "unknown":
      return formatAsString(value);
    default:
      return formatAsString(value);
  }
}

export interface MindbodyMappingRef {
  hubspot_property: string;
  mindbody_field: string;
  hubspot_property_type?: string | null;
  mindbody_field_type?: string | null;
}

/** Map one Mindbody record through saved mappings into HubSpot property strings. */
export function mapMindbodyFieldsToHubspot(
  mappings: MindbodyMappingRef[],
  mindbody: Record<string, unknown>
): Record<string, string> {
  const props: Record<string, string> = {};

  for (const mapping of mappings) {
    const raw = extractMindbodyValue(mindbody, mapping.mindbody_field);
    if (raw === undefined || raw === null) continue;

    const formatted = formatForHubspot(
      raw,
      mapping.hubspot_property_type,
      mapping.mindbody_field_type
    );
    if (formatted !== null) {
      props[mapping.hubspot_property] = formatted;
    }
  }

  return props;
}
