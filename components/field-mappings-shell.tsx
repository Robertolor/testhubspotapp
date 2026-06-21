"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import {
  filterCatalogItems,
  MappingCatalogPanel,
  type CatalogListItem,
} from "@/components/mapping-catalog-panel";
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
    <div className="mt-6 grid gap-4 lg:grid-cols-2" aria-busy="true">
      <div className="h-[360px] animate-pulse rounded-lg bg-slate-100" />
      <div className="h-[360px] animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}

export function FieldMappingsShell({ tenantId }: { tenantId: string }) {
  const [entity, setEntity] = useState<MappingEntityTab>("contact");
  const [loading, setLoading] = useState(true);
  const [hubspotError, setHubspotError] = useState<string | null>(null);
  const [mindbodyError, setMindbodyError] = useState<string | null>(null);
  const [hubspotItems, setHubspotItems] = useState<CatalogListItem[]>([]);
  const [mindbodyItems, setMindbodyItems] = useState<CatalogListItem[]>([]);
  const [hubspotSearch, setHubspotSearch] = useState("");
  const [mindbodySearch, setMindbodySearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCatalogs() {
      setLoading(true);
      setHubspotError(null);
      setMindbodyError(null);
      setHubspotSearch("");
      setMindbodySearch("");

      const hubspotObject = entity === "contact" ? "contacts" : "deals";

      try {
        const hubspotRes = await fetch(
          `/api/tenants/${tenantId}/mapping/catalog/hubspot?object=${hubspotObject}`
        );
        const hubspotData = (await hubspotRes.json()) as {
          properties?: HubspotCatalogProperty[];
          error?: string;
        };
        if (!hubspotRes.ok) {
          throw new Error(hubspotData.error ?? "Failed to load HubSpot catalog");
        }
        if (!cancelled) {
          setHubspotItems(toHubspotItems(hubspotData.properties ?? []));
        }
      } catch (e) {
        if (!cancelled) {
          setHubspotItems([]);
          setHubspotError(
            e instanceof Error ? e.message : "Failed to load HubSpot catalog"
          );
        }
      }

      if (entity === "contact") {
        try {
          const mindbodyRes = await fetch(
            `/api/tenants/${tenantId}/mapping/catalog/mindbody?entity=contact`
          );
          const mindbodyData = (await mindbodyRes.json()) as {
            fields?: MindbodyCatalogField[];
            error?: string;
          };
          if (!mindbodyRes.ok) {
            throw new Error(
              mindbodyData.error ?? "Failed to load Mindbody catalog"
            );
          }
          if (!cancelled) {
            setMindbodyItems(toMindbodyItems(mindbodyData.fields ?? []));
          }
        } catch (e) {
          if (!cancelled) {
            setMindbodyItems([]);
            setMindbodyError(
              e instanceof Error ? e.message : "Failed to load Mindbody catalog"
            );
          }
        }
      } else if (!cancelled) {
        setMindbodyItems([]);
        setMindbodyError(null);
      }

      if (!cancelled) setLoading(false);
    }

    void loadCatalogs();
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
          Browse HubSpot properties and Mindbody fields. Read-only — mapping
          editor comes in a later step.
        </p>

        {loading ? (
          <MappingsSkeleton />
        ) : (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
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
                  Sale and contract field lists will be added in a later step.
                  HubSpot deal properties are available on the left.
                </p>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
