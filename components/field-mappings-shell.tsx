"use client";

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
import type { MindbodyDealSource } from "@/lib/db/types";
import { cn } from "@/lib/utils";

type MappingEntityTab = "contact" | "deal";

const TABS: { id: MappingEntityTab; label: string }[] = [
  { id: "contact", label: "Contacts" },
  { id: "deal", label: "Deals" },
];

const DEAL_SOURCE_TABS: { id: MindbodyDealSource; label: string }[] = [
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

export function FieldMappingsShell({ tenantId }: { tenantId: string }) {
  const [entity, setEntity] = useState<MappingEntityTab>("contact");
  const [dealSource, setDealSource] = useState<MindbodyDealSource>("contract");
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [saveWarnings, setSaveWarnings] = useState<string[]>([]);

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

    const hubspotObject = entity === "contact" ? "contacts" : "deals";

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

    if (entity === "contact") {
      try {
        const res = await fetch(
          `/api/tenants/${tenantId}/mapping/catalog/mindbody?entity=contact`
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
    } else {
      try {
        const res = await fetch(
          `/api/tenants/${tenantId}/mapping/catalog/mindbody?entity=${dealSource}`
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
    }

    try {
      const mappingsUrl =
        entity === "deal"
          ? `/api/tenants/${tenantId}/mapping/fields?entity=deal&mindbodySource=${dealSource}`
          : `/api/tenants/${tenantId}/mapping/fields?entity=${entity}`;
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
  }, [entity, dealSource, tenantId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
    setSaveError(null);
    setSaveErrors([]);
    setSaveWarnings([]);

    try {
      const res = await fetch(`/api/tenants/${tenantId}/mapping/fields`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity,
          ...(entity === "deal" ? { mindbodySource: dealSource } : {}),
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
    entity === "contact"
      ? "Contact mappings"
      : dealSource === "contract"
        ? "Deal mappings — contracts"
        : "Deal mappings — sales";

  const helperText =
    entity === "contact"
      ? "Use + Add mapping and Remove on non-system rows, then save. Email and Client ID stay locked."
      : dealSource === "contract"
        ? "Map Mindbody contract fields to HubSpot deal properties. Contract ID stays locked when configured as a system row."
        : "Map Mindbody sale fields to HubSpot deal properties. Sale ID stays locked when configured as a system row.";

  return (
    <div className="mt-6">
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-100 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setEntity(tab.id)}
            className={cn(
              "flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              entity === tab.id
                ? "bg-white text-teal-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {entity === "deal" ? (
        <div className="mt-3 flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
          {DEAL_SOURCE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setDealSource(tab.id)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                dealSource === tab.id
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
              saveError={saveError}
              saveErrors={saveErrors}
              saveWarnings={saveWarnings}
              canEditMindbody={entity === "contact" || entity === "deal"}
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
                    description={
                      entity === "contact"
                        ? "Contact properties from your portal"
                        : "Deal properties from your portal"
                    }
                    search={hubspotSearch}
                    onSearchChange={setHubspotSearch}
                    loading={false}
                    error={hubspotError}
                    items={filteredHubspot}
                    totalCount={hubspotItems.length}
                  />
                  {entity === "contact" ? (
                    <MappingCatalogPanel
                      title="Mindbody fields"
                      description="Client fields from your Mindbody site"
                      search={mindbodySearch}
                      onSearchChange={setMindbodySearch}
                      loading={false}
                      error={mindbodyError}
                      items={filteredMindbody}
                      totalCount={mindbodyItems.length}
                    />
                  ) : (
                    <MappingCatalogPanel
                      title={
                        dealSource === "contract"
                          ? "Mindbody contract fields"
                          : "Mindbody sale fields"
                      }
                      description={
                        dealSource === "contract"
                          ? "Fields from Mindbody client contracts"
                          : "Fields from Mindbody sales"
                      }
                      search={mindbodySearch}
                      onSearchChange={setMindbodySearch}
                      loading={false}
                      error={mindbodyError}
                      items={filterCatalogItems(mindbodyItems, mindbodySearch)}
                      totalCount={mindbodyItems.length}
                    />
                  )}
                </div>
              </div>
            </details>
          </>
        )}
      </Card>
    </div>
  );
}
