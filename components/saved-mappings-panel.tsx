"use client";

import type { FieldMappingItem } from "@/lib/mapping/fields";
import { cn } from "@/lib/utils";

export interface EnrichedMappingRow extends FieldMappingItem {
  hubspotLabel?: string;
  mindbodyLabel?: string;
}

interface SavedMappingsPanelProps {
  loading: boolean;
  error: string | null;
  mappings: EnrichedMappingRow[];
  readOnly?: boolean;
}

export function SavedMappingsPanel({
  loading,
  error,
  mappings,
  readOnly = true,
}: SavedMappingsPanelProps) {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50/50">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-900">Current mappings</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Active field pairs used for sync. System rows are required and locked.
        </p>
      </div>

      {loading ? (
        <ul className="space-y-2 p-4" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="h-16 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </ul>
      ) : error ? (
        <p className="p-4 text-sm text-red-600">{error}</p>
      ) : mappings.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No mappings configured yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {mappings.map((row) => (
            <li
              key={row.id}
              className={cn(
                "flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
                row.isSystem && "bg-amber-50/60"
              )}
            >
              <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <MappingEndpoint
                  title="HubSpot"
                  label={row.hubspotLabel ?? row.hubspotProperty}
                  name={row.hubspotProperty}
                  type={row.hubspotPropertyType}
                />
                <span
                  className="hidden text-center text-slate-400 sm:block"
                  aria-hidden="true"
                >
                  ↔
                </span>
                <MappingEndpoint
                  title="Mindbody"
                  label={row.mindbodyLabel ?? row.mindbodyField}
                  name={row.mindbodyField}
                  type={row.mindbodyFieldType}
                />
              </div>

              <div className="flex shrink-0 items-center gap-2 sm:pl-4">
                {row.isSystem ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
                    title="Required for sync — cannot be removed"
                  >
                    <LockIcon />
                    System
                  </span>
                ) : null}
                {!readOnly && !row.isSystem ? (
                  <button
                    type="button"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white"
                  >
                    Remove
                  </button>
                ) : null}
                {readOnly && !row.isSystem ? (
                  <span className="text-xs text-slate-400">Editable soon</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MappingEndpoint({
  title,
  label,
  name,
  type,
}: {
  title: string;
  label: string;
  name: string;
  type: string | null;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="truncate text-sm font-medium text-slate-900">{label}</p>
      <p className="truncate font-mono text-xs text-slate-500">{name}</p>
      {type ? (
        <p className="mt-0.5 text-xs text-slate-400">{type}</p>
      ) : null}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      className="h-3 w-3"
      aria-hidden="true"
    >
      <path d="M4.5 7V5a3.5 3.5 0 1 1 7 0v2h.5A1.5 1.5 0 0 1 13.5 8.5v5A1.5 1.5 0 0 1 12 15H4a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 4 7.5h.5Zm1.5 0h4V5a2 2 0 1 0-4 0v2Z" />
    </svg>
  );
}

export function enrichMappings(
  mappings: FieldMappingItem[],
  hubspotByName: Map<string, { label: string }>,
  mindbodyByKey: Map<string, { label: string }>
): EnrichedMappingRow[] {
  return mappings.map((row) => ({
    ...row,
    hubspotLabel: hubspotByName.get(row.hubspotProperty)?.label,
    mindbodyLabel: mindbodyByKey.get(row.mindbodyField)?.label,
  }));
}
