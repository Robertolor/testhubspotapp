/** Calendar date YYYY-MM-DD, or null when unset. */
export function parseCutoffDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  const text = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  return text;
}

export function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Later of two YYYY-MM-DD values (nulls ignored). */
export function laterIsoDate(
  a: string | null | undefined,
  b: string | null | undefined
): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a >= b ? a : b;
}

/**
 * Whether a Mindbody record should sync given an inclusive cutoff.
 * Missing record dates are included so we do not drop live rows silently.
 */
export function recordOnOrAfterCutoff(
  cutoff: string | null,
  recordDate: unknown
): boolean {
  if (!cutoff) return true;
  const date = parseCutoffDate(recordDate);
  if (!date) return true;
  return date >= cutoff;
}

export function extractMindbodyRecordDate(
  payload: Record<string, unknown>
): string | null {
  return parseCutoffDate(
    payload.CreationDate ??
      payload.SaleDateTime ??
      payload.SaleDate ??
      payload.StartDateTime ??
      payload.StartDate ??
      payload.contractStartDateTime ??
      payload.LastModifiedDateTime
  );
}

/** Start of a pull window: do not go earlier than cutoff, else use the default lookback. */
export function windowStartDate(
  defaultLookbackDays: number,
  cutoff: string | null
): string {
  return laterIsoDate(isoDateDaysAgo(defaultLookbackDays), cutoff) ?? isoDateDaysAgo(defaultLookbackDays);
}
