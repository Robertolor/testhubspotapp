"use client";

import { Button } from "@/components/ui/button";
import {
  MappingFieldPicker,
  type PickerOption,
} from "@/components/mapping-field-picker";
import { cn } from "@/lib/utils";

export interface DraftMappingRow {
  id: string;
  hubspotProperty: string;
  mindbodyField: string;
  isSystem: boolean;
}

interface MappingsEditorPanelProps {
  loading: boolean;
  loadError: string | null;
  rows: DraftMappingRow[];
  hubspotOptionsForRow: (rowId: string) => PickerOption[];
  mindbodyOptionsForRow: (rowId: string) => PickerOption[];
  hubspotLabel: (name: string) => string | undefined;
  mindbodyLabel: (key: string) => string | undefined;
  hubspotType: (name: string) => string | undefined;
  mindbodyType: (key: string) => string | undefined;
  dirty: boolean;
  saveEnabled: boolean;
  saving: boolean;
  saveError: string | null;
  saveErrors: string[];
  saveWarnings: string[];
  canEditMindbody: boolean;
  onRowsChange: (rows: DraftMappingRow[]) => void;
  onSave: () => void;
  onCancel: () => void;
  onAddRow: () => void;
}

export function MappingsEditorPanel({
  loading,
  loadError,
  rows,
  hubspotOptionsForRow,
  mindbodyOptionsForRow,
  hubspotLabel,
  mindbodyLabel,
  hubspotType,
  mindbodyType,
  dirty,
  saveEnabled,
  saving,
  saveError,
  saveErrors,
  saveWarnings,
  canEditMindbody,
  onRowsChange,
  onSave,
  onCancel,
  onAddRow,
}: MappingsEditorPanelProps) {
  function updateRow(
    rowId: string,
    patch: Partial<Pick<DraftMappingRow, "hubspotProperty" | "mindbodyField">>
  ) {
    onRowsChange(
      rows.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    );
  }

  function removeRow(rowId: string) {
    onRowsChange(rows.filter((row) => row.id !== rowId));
  }

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50">
      <div className="border-b border-slate-200 bg-white px-4 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Current mappings
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Use <strong>Add mapping</strong> to create a pair, click field
              boxes to change non-system rows, then <strong>Save mappings</strong>.
              System rows (e.g. Email) cannot be removed.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onAddRow}>
              + Add mapping
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={!dirty || saving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={onSave} disabled={!saveEnabled || saving}>
              {saving ? "Saving…" : "Save mappings"}
            </Button>
          </div>
        </div>
      </div>

      {saveError || saveErrors.length > 0 ? (
        <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {saveError ? <p className="font-medium">{saveError}</p> : null}
          {saveErrors.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {saveErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {saveWarnings.length > 0 ? (
        <div className="border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {saveWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}

      {loading ? (
        <ul className="space-y-2 p-4" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="h-20 animate-pulse rounded-lg bg-slate-100" />
          ))}
        </ul>
      ) : loadError ? (
        <p className="p-4 text-sm text-red-600">{loadError}</p>
      ) : rows.length === 0 ? (
        <p className="p-4 text-sm text-slate-500">No mappings configured yet.</p>
      ) : (
        <ul className="divide-y divide-slate-200">
          {rows.map((row) => (
            <li
              key={row.id}
              className={cn(
                "flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-start",
                row.isSystem && "bg-amber-50/60"
              )}
            >
              {row.isSystem ? (
                <div className="grid min-w-0 flex-1 gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
                  <LockedEndpoint
                    title="HubSpot"
                    label={hubspotLabel(row.hubspotProperty) ?? row.hubspotProperty}
                    name={row.hubspotProperty}
                    type={hubspotType(row.hubspotProperty)}
                  />
                  <span className="hidden text-center text-slate-400 lg:block">
                    ↔
                  </span>
                  <LockedEndpoint
                    title="Mindbody"
                    label={mindbodyLabel(row.mindbodyField) ?? row.mindbodyField}
                    name={row.mindbodyField}
                    type={mindbodyType(row.mindbodyField)}
                  />
                </div>
              ) : (
                <div className="grid min-w-0 flex-1 gap-3 rounded-lg border border-dashed border-slate-300 bg-white p-3 lg:grid-cols-[1fr_auto_1fr] lg:items-start">
                  <MappingFieldPicker
                    label="HubSpot"
                    value={row.hubspotProperty}
                    options={hubspotOptionsForRow(row.id)}
                    onChange={(value) =>
                      updateRow(row.id, { hubspotProperty: value })
                    }
                  />
                  <span className="hidden self-center text-slate-400 lg:block">
                    ↔
                  </span>
                  <MappingFieldPicker
                    label="Mindbody"
                    value={row.mindbodyField}
                    options={mindbodyOptionsForRow(row.id)}
                    onChange={(value) =>
                      updateRow(row.id, { mindbodyField: value })
                    }
                    disabled={!canEditMindbody}
                  />
                </div>
              )}

              <div className="flex shrink-0 items-center gap-2 lg:pt-6">
                {row.isSystem ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900">
                    System
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !loadError ? (
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          <Button type="button" variant="secondary" onClick={onAddRow}>
            + Add mapping
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function LockedEndpoint({
  title,
  label,
  name,
  type,
}: {
  title: string;
  label: string;
  name: string;
  type?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {title}
      </p>
      <p className="truncate text-sm font-medium text-slate-900">{label}</p>
      <p className="truncate font-mono text-xs text-slate-500">{name}</p>
      {type ? <p className="mt-0.5 text-xs text-slate-400">{type}</p> : null}
    </div>
  );
}

export function draftFromSaved(
  rows: {
    id: string;
    hubspotProperty: string;
    mindbodyField: string;
    isSystem: boolean;
  }[]
): DraftMappingRow[] {
  return rows.map((row) => ({
    id: row.id,
    hubspotProperty: row.hubspotProperty,
    mindbodyField: row.mindbodyField,
    isSystem: row.isSystem,
  }));
}

export function sortDraftRows(rows: DraftMappingRow[]): DraftMappingRow[] {
  return [...rows].sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    return a.hubspotProperty.localeCompare(b.hubspotProperty);
  });
}
