"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import {
  filterCatalogItems,
  MappingCatalogPanel,
  type CatalogListItem,
} from "@/components/mapping-catalog-panel";
import type { FieldMappingItem } from "@/lib/mapping/fields";
import {
  enrichMappings,
  SavedMappingsPanel,
} from "@/components/saved-mappings-panel";
import { cn } from "@/lib/utils";

type MappingEntityTab = "contact" | "deal";

const TABS: { id: MappingEntityTab; label: string }[] = [
  { id: "contact", label: "Contacts" },
  { id: "deal", label: "Deals" },
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
        <div className="h-[360px] animate-pulse rounded-lg bg-slate-100" />
        <div className="h-[360px] animate-pulse rounded-lg bg-slate-100" />
      </div>
    </div>
  );
}

export function FieldMappingsShell({ tenantId }: { tenantId: string }) {
  const [entity, setEntity] = useState<MappingEntityTab>("contact");
  const [loading, setLoading] = useState(true);
  const [hubspotError, setHubspotError] = useState<string | null>(null);
  const [mindbodyError, setMindbodyError] = useState<string | null>(null);
  const [mappingsError, setMappingsError] = useState<string | null>(null);
  const [hubspotItems, setHubspotItems] = useState<CatalogListItem[]>([]);
  const [mindbodyItems, setMindbodyItems] = useState<CatalogListItem[]>([]);
  const [savedMappings, setSavedMappings] = useState<FieldMappingItem[]>([]);
  const [hubspotSearch, setHubspotSearch] = useState("");
  const [mindbodySearch, setMindbodySearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setHubspotError(null);
      setMindbodyError(null);
      setMappingsError(null);
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
      }

      try {
        const res = await fetch(
          `/api/tenants/${tenantId}/mapping/fields?entity=${entity}`
        );
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

      if (cancelled) return;

      setHubspotItems(toHubspotItems(hubspotProperties));
      setMindbodyItems(toMindbodyItems(mindbodyFields));
      setSavedMappings(mappings);
      setLoading(false);
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [entity, tenantId]);

  const filteredHubspot = useMemo(
    () => filterCatalogItems(hubspotItems, hubspotSearch),
    [hubspotItems, hubspotSearch]
  );
  const filteredMindbody = useMemo(
    () => filterCatalogItems(mindbodyItems, mindbodySearch),
    [mindbodyItems, mindbodySearch]
  );

  const hubspotByName = useMemo(
    () => new Map(hubspotItems.map((item) => [item.name, { label: item.label }])),
    [hubspotItems]
  );
  const mindbodyByKey = useMemo(
    () => new Map(mindbodyItems.map((item) => [item.name, { label: item.label }])),
    [mindbodyItems]
  );

  const enrichedMappings = useMemo(() => {
    const rows = enrichMappings(savedMappings, hubspotByName, mindbodyByKey);
    return [...rows].sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
      return a.hubspotProperty.localeCompare(b.hubspotProperty);
    });
  }, [savedMappings, hubspotByName, mindbodyByKey]);

  const heading =
    entity === "contact" ? "Contact mappings" : "Deal mappings";

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

      <Card className="mt-6">
        <CardTitle>{heading}</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Review active mappings and browse available fields. Editing and save
          come in the next phase.
        </p>

        {loading ? (
          <MappingsSkeleton />
        ) : (
          <>
            <SavedMappingsPanel
              loading={false}
              error={mappingsError}
              mappings={enrichedMappings}
              readOnly
            />

            <div className="mt-8">
              <h3 className="text-sm font-semibold text-slate-900">
                Field catalogs
              </h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Browse all available properties when adding mappings later.
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
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
                  <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm text-slate-500">
                    <p className="font-medium text-slate-700">
                      Mindbody deal catalogs
                    </p>
                    <p className="mt-2 max-w-xs">
                      Sale and contract field lists will be added in a later
                      step.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
