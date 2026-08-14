"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import {
  filterCatalogItems,
  MappingCatalogPanel,
  type CatalogListItem,
} from "@/components/mapping-catalog-panel";
import type { FieldMappingItem } from "@/lib/mapping/fields";
import {
  draftFromSaved,
  MappingsEditorPanel,
  sortDraftRows,
  type DraftMappingRow,
} from "@/components/mappings-editor-panel";
import type { PickerOption } from "@/components/mapping-field-picker";
import type { MindbodyMappingSource } from "@/lib/db/types";
import { cn } from "@/lib/utils";

type MappingEntityTab = "contact" | "deal" | "line_item";

interface RuntimeSettings {
  appointments_enabled: boolean;
  visits_enabled: boolean;
  line_items_enabled: boolean;
}

const BASE_DEAL_SOURCE_TABS: { id: MindbodyMappingSource; label: string }[] = [
  { id: "contract", label: "Contracts" },
  { id: "sale", label: "Sales" },
];

interface HubspotCatalogProperty {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  readOnly: boolean;
  groupName: string;
}

interface MindbodyCatalogField {
  key: string;
  label: string;
  type: string;
  groupName: string;
  isCustom: boolean;
}

function toHubspotItems(properties: HubspotCatalogProperty[]): CatalogListItem[] {
  return properties.map((prop) => ({
    id: prop.name,
    label: prop.label,
    name: prop.name,
    type: prop.type,
    detail: `${prop.fieldType}${prop.readOnly ? " · read-only" : ""}`,
    badge:
      prop.groupName === "mindbody_sync"
        ? "mindbody"
        : prop.readOnly
          ? "read-only"
          : undefined,
    muted: prop.readOnly,
  }));
}

function toMindbodyItems(fields: MindbodyCatalogField[]): CatalogListItem[] {
  return fields.map((field) => ({
    id: field.key,
    label: field.label,
    name: field.key,
    type: field.type,
    detail: field.groupName,
    badge: field.isCustom ? "custom" : field.groupName,
  }));
}

function MappingsSkeleton() {
  return (
    <div className="mt-6 space-y-4" aria-busy="true">
      <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-[280px] animate-pulse rounded-lg bg-slate-100" />
        <div className="h-[280px] animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

function mappingsEqual(a: DraftMappingRow[], b: DraftMappingRow[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = sortDraftRows(a);
  const sortedB = sortDraftRows(b);
  return sortedA.every(
    (row, index) =>
      row.hubspotProperty === sortedB[index].hubspotProperty &&
      row.mindbodyField === sortedB[index].mindbodyField &&
      row.isSystem === sortedB[index].isSystem
  );
}

function dealSourceLabel(source: MindbodyMappingSource): string {
  switch (source) {
    case "contract":
      return "contracts";
    case "sale":
      return "sales";
    case "appointment":
      return "appointments";
    case "visit":
      return "visits";
  }
}

export function FieldMappingsShell({ tenantId }: { tenantId: string }) {
  const [entity, setEntity] = useState<MappingEntityTab>("contact");
  const [dealSource, setDealSource] =
    useState<MindbodyMappingSource>("contract");
  const [runtimeSettings, setRuntimeSettings] = useState<RuntimeSettings>({
    appointments_enabled: false,
    visits_enabled: false,
    line_items_enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [hubspotError, setHubspotError] = useState<string | null>(null);
  const [mindbodyError, setMindbodyError] = useState<string | null>(null);
  const [mappingsError, setMappingsError] = useState<string | null>(null);
  const [hubspotCatalog, setHubspotCatalog] = useState<HubspotCatalogProperty[]>(
    []
  );
  const [mindbodyCatalog, setMindbodyCatalog] = useState<MindbodyCatalogField[]>(
    []
  );
  const [hubspotItems, setHubspotItems] = useState<CatalogListItem[]>([]);
  const [mindbodyItems, setMindbodyItems] = useState<CatalogListItem[]>([]);
  const [draftRows, setDraftRows] = useState<DraftMappingRow[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState<DraftMappingRow[]>([]);
  const [hubspotSearch, setHubspotSearch] = useState("");
  const [mindbodySearch, setMindbodySearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [saveWarnings, setSaveWarnings] = useState<string[]>([]);

  useEffect(() => {
    fetch(`/api/tenants/${tenantId}/settings`)
      .then((r) => r.json())
      .then((data: { settings?: RuntimeSettings }) => {
        if (data.settings) {
          setRuntimeSettings({
            appointments_enabled: data.settings.appointments_enabled ?? false,
            visits_enabled: data.settings.visits_enabled ?? false,
            line_items_enabled: data.settings.line_items_enabled ?? false,
          });
        }
      })
      .catch(() => {
        // Keep defaults if settings cannot be loaded.
      });
  }, [tenantId]);

  const mainTabs = useMemo(() => {
    const tabs: { id: MappingEntityTab; label: string }[] = [
      { id: "contact", label: "Contacts" },
      { id: "deal", label: "Deals" },
    ];
    if (runtimeSettings.line_items_enabled) {
      tabs.push({ id: "line_item", label: "Line items" });
    }
    return tabs;
  }, [runtimeSettings.line_items_enabled]);

  const dealSourceTabs = useMemo(() => {
    const tabs = [...BASE_DEAL_SOURCE_TABS];
    if (runtimeSettings.appointments_enabled) {
      tabs.push({ id: "appointment", label: "Appointments" });
    }
    if (runtimeSettings.visits_enabled) {
      tabs.push({ id: "visit", label: "Visits" });
    }
    return tabs;
  }, [runtimeSettings.appointments_enabled, runtimeSettings.visits_enabled]);

  const resolvedEntity = useMemo((): MappingEntityTab => {
    if (mainTabs.some((tab) => tab.id === entity)) return entity;
    return mainTabs[0]?.id ?? "contact";
  }, [entity, mainTabs]);

  const resolvedDealSource = useMemo((): MindbodyMappingSource => {
    if (dealSourceTabs.some((tab) => tab.id === dealSource)) return dealSource;
    return dealSourceTabs[0]?.id ?? "contract";
  }, [dealSource, dealSourceTabs]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setHubspotError(null);
    setMindbodyError(null);
    setMappingsError(null);
    setSaveError(null);
    setSaveErrors([]);
    setSaveWarnings([]);
    setHubspotSearch("");
    setMindbodySearch("");

    const hubspotObject =
      resolvedEntity === "contact"
        ? "contacts"
        : resolvedEntity === "line_item"
          ? "line_items"
          : "deals";

    let hubspotProperties: HubspotCatalogProperty[] = [];
    let mindbodyFields: MindbodyCatalogField[] = [];
    let mappings: FieldMappingItem[] = [];

    try {
      const res = await fetch(
        `/api/tenants/${tenantId}/mapping/catalog/hubspot?object=${hubspotObject}`
      );
      const data = (await res.json()) as {
        properties?: HubspotCatalogProperty[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load HubSpot catalog");
      }
      hubspotProperties = data.properties ?? [];
    } catch (e) {
      setHubspotError(
        e instanceof Error ? e.message : "Failed to load HubSpot catalog"
      );
    }

    const mindbodyEntity =
      resolvedEntity === "contact"
        ? "contact"
        : resolvedEntity === "line_item"
          ? "line_item"
          : resolvedDealSource;

    try {
      const res = await fetch(
        `/api/tenants/${tenantId}/mapping/catalog/mindbody?entity=${mindbodyEntity}`
      );
      const data = (await res.json()) as {
        fields?: MindbodyCatalogField[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load Mindbody catalog");
      }
      mindbodyFields = data.fields ?? [];
    } catch (e) {
      setMindbodyError(
        e instanceof Error ? e.message : "Failed to load Mindbody catalog"
      );
    }

    try {
      const mappingsUrl =
        resolvedEntity === "deal"
          ? `/api/tenants/${tenantId}/mapping/fields?entity=deal&mindbodySource=${resolvedDealSource}`
          : `/api/tenants/${tenantId}/mapping/fields?entity=${resolvedEntity}`;
      const res = await fetch(mappingsUrl);
      const data = (await res.json()) as {
        mappings?: FieldMappingItem[];
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Failed to load saved mappings");
      }
      mappings = data.mappings ?? [];
    } catch (e) {
      setMappingsError(
        e instanceof Error ? e.message : "Failed to load saved mappings"
      );
    }

    setHubspotCatalog(hubspotProperties);
    setMindbodyCatalog(mindbodyFields);
    setHubspotItems(toHubspotItems(hubspotProperties));
    setMindbodyItems(toMindbodyItems(mindbodyFields));
    const draft = sortDraftRows(draftFromSaved(mappings));
    setDraftRows(draft);
    setSavedSnapshot(draft);
    setLoading(false);
  }, [resolvedEntity, resolvedDealSource, tenantId]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void loadData();
    });
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  useEffect(() => {
    if (!saveSuccess) return;
    const timer = window.setTimeout(() => setSaveSuccess(false), 2000);
    return () => window.clearTimeout(timer);
  }, [saveSuccess]);

  const dirty = useMemo(
    () => !mappingsEqual(draftRows, savedSnapshot),
    [draftRows, savedSnapshot]
  );

  const canSave = useMemo(
    () =>
      dirty &&
      draftRows.length > 0 &&
      draftRows.every((row) => row.hubspotProperty && row.mindbodyField),
    [dirty, draftRows]
  );

  const hubspotByName = useMemo(
    () => new Map(hubspotCatalog.map((item) => [item.name, item])),
    [hubspotCatalog]
  );
  const mindbodyByKey = useMemo(
    () => new Map(mindbodyCatalog.map((item) => [item.key, item])),
    [mindbodyCatalog]
  );

  const hubspotOptionsForRow = useCallback(
    (rowId: string): PickerOption[] => {
      const current = draftRows.find((row) => row.id === rowId);
      const used = new Set(
        draftRows
          .filter((row) => row.id !== rowId && row.hubspotProperty)
          .map((row) => row.hubspotProperty)
      );
      return hubspotCatalog
        .filter((prop) => !prop.readOnly)
        .map((prop) => ({
          value: prop.name,
          label: prop.label,
          detail: prop.type,
          disabled: used.has(prop.name) && prop.name !== current?.hubspotProperty,
        }));
    },
    [draftRows, hubspotCatalog]
  );

  const mindbodyOptionsForRow = useCallback(
    (rowId: string): PickerOption[] => {
      const current = draftRows.find((row) => row.id === rowId);
      const used = new Set(
        draftRows
          .filter((row) => row.id !== rowId && row.mindbodyField)
          .map((row) => row.mindbodyField)
      );
      return mindbodyCatalog.map((field) => ({
        value: field.key,
        label: field.label,
        detail: field.type,
        disabled: used.has(field.key) && field.key !== current?.mindbodyField,
      }));
    },
    [draftRows, mindbodyCatalog]
  );

  async function handleSave() {
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    setSaveErrors([]);
    setSaveWarnings([]);

    try {
      const res = await fetch(`/api/tenants/${tenantId}/mapping/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity: resolvedEntity,
          ...(resolvedEntity === "deal"
            ? { mindbodySource: resolvedDealSource }
            : {}),
          mappings: draftRows.map((row) => ({
            hubspotProperty: row.hubspotProperty,
            mindbodyField: row.mindbodyField,
          })),
        }),
      });
      const data = (await res.json()) as {
        mappings?: FieldMappingItem[];
        warnings?: string[];
        error?: string;
        errors?: string[];
      };

      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save mappings");
        setSaveErrors(data.errors ?? []);
        return;
      }

      const next = sortDraftRows(draftFromSaved(data.mappings ?? []));
      setDraftRows(next);
      setSavedSnapshot(next);
      setSaveWarnings(data.warnings ?? []);
      setSaveSuccess(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save mappings");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDraftRows(savedSnapshot);
    setSaveError(null);
    setSaveErrors([]);
    setSaveWarnings([]);
    setSaveSuccess(false);
  }

  function handleAddRow() {
    setDraftRows((rows) =>
      sortDraftRows([
        ...rows,
        {
          id: crypto.randomUUID(),
          hubspotProperty: "",
          mindbodyField: "",
          isSystem: false,
        },
      ])
    );
  }

  const filteredHubspot = useMemo(
    () => filterCatalogItems(hubspotItems, hubspotSearch),
    [hubspotItems, hubspotSearch]
  );
  const filteredMindbody = useMemo(
    () => filterCatalogItems(mindbodyItems, mindbodySearch),
    [mindbodyItems, mindbodySearch]
  );

  const heading =
    resolvedEntity === "contact"
      ? "Contact mappings"
      : resolvedEntity === "line_item"
        ? "Line item mappings"
        : `Deal mappings — ${dealSourceLabel(resolvedDealSource)}`;

  const helperText =
    resolvedEntity === "contact"
      ? "Use + Add mapping and Remove on non-system rows, then save. Email and Client ID stay locked."
      : resolvedEntity === "line_item"
        ? "Map Mindbody purchase line item fields to HubSpot line item properties. Sync starts when line items are enabled in Settings."
        : resolvedDealSource === "contract"
          ? "Map Mindbody contract fields to HubSpot deal properties. Contract ID stays locked when configured as a system row."
          : resolvedDealSource === "sale"
            ? "Map Mindbody sale fields to HubSpot deal properties. Sale ID stays locked when configured as a system row."
            : `Map Mindbody ${dealSourceLabel(resolvedDealSource)} fields to HubSpot deal properties. Sync starts when ${dealSourceLabel(resolvedDealSource)} are enabled in Settings.`;

  const mindbodyCatalogTitle =
    resolvedEntity === "contact"
      ? "Mindbody fields"
      : resolvedEntity === "line_item"
        ? "Mindbody line item fields"
        : `Mindbody ${dealSourceLabel(resolvedDealSource)} fields`;

  const mindbodyCatalogDescription =
    resolvedEntity === "contact"
      ? "Client fields from your Mindbody site"
      : resolvedEntity === "line_item"
        ? "Fields from Mindbody purchase line items"
        : `Fields from Mindbody ${dealSourceLabel(resolvedDealSource)}`;

  const hubspotCatalogDescription =
    resolvedEntity === "contact"
      ? "Contact properties from your portal"
      : resolvedEntity === "line_item"
        ? "Line item properties from your portal"
        : "Deal properties from your portal";

  const hasExpandedEntities =
    runtimeSettings.appointments_enabled ||
    runtimeSettings.visits_enabled ||
    runtimeSettings.line_items_enabled;

  return (
    <div className="mt-6">
      <p className="text-sm text-slate-600">
        Appointments, visits, and line items appear here after you enable them in{" "}
        <Link href="/settings" className="font-medium text-teal-700 underline">
          Settings → Runtime sync controls
        </Link>
        . Mapping configuration is saved even before sync ships.
      </p>

      {!hasExpandedEntities ? (
        <p className="mt-2 text-xs text-slate-500">
          Only contacts and deals (contracts/sales) are shown until expanded
          entities are enabled.
        </p>
      ) : null}

      <div className="mt-4 flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
        {mainTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setEntity(tab.id)}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              resolvedEntity === tab.id
                ? "bg-white text-teal-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {resolvedEntity === "deal" ? (
        <div className="mt-3 flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {dealSourceTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDealSource(tab.id)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                resolvedDealSource === tab.id
                  ? "bg-white text-teal-800 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <Card className="mt-6">
        <CardTitle>{heading}</CardTitle>
        <p className="mt-1 text-sm text-slate-500">{helperText}</p>

        {loading ? (
          <MappingsSkeleton />
        ) : (
          <>
            <MappingsEditorPanel
              loading={false}
              loadError={mappingsError}
              rows={draftRows}
              hubspotOptionsForRow={hubspotOptionsForRow}
              mindbodyOptionsForRow={mindbodyOptionsForRow}
              hubspotLabel={(name) => hubspotByName.get(name)?.label}
              mindbodyLabel={(key) => mindbodyByKey.get(key)?.label}
              hubspotType={(name) => hubspotByName.get(name)?.type}
              mindbodyType={(key) => mindbodyByKey.get(key)?.type}
              dirty={dirty}
              saveEnabled={canSave}
              saving={saving}
              saveSuccess={saveSuccess}
              saveError={saveError}
              saveErrors={saveErrors}
              saveWarnings={saveWarnings}
              canEditMindbody
              onRowsChange={setDraftRows}
              onSave={() => void handleSave()}
              onCancel={handleCancel}
              onAddRow={handleAddRow}
            />

            <details className="mt-8 rounded-lg border border-slate-200 bg-white">
              <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-900">
                Browse field catalogs
              </summary>
              <div className="border-t border-slate-100 p-4">
                <p className="mb-4 text-xs text-slate-500">
                  Search all available fields. Use the mapping editor above to
                  select fields with searchable pickers.
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  <MappingCatalogPanel
                    title="HubSpot properties"
                    description={hubspotCatalogDescription}
                    search={hubspotSearch}
                    onSearchChange={setHubspotSearch}
                    loading={false}
                    error={hubspotError}
                    items={filteredHubspot}
                    totalCount={hubspotItems.length}
                  />
                  <MappingCatalogPanel
                    title={mindbodyCatalogTitle}
                    description={mindbodyCatalogDescription}
                    search={mindbodySearch}
                    onSearchChange={setMindbodySearch}
                    loading={false}
                    error={mindbodyError}
                    items={filteredMindbody}
                    totalCount={mindbodyItems.length}
                  />
                </div>
              </div>
            </details>
          </>
        )}
      </Card>
    </div>
  );
}
