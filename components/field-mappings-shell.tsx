"use client";

import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type MappingEntityTab = "contact" | "deal";

const TABS: { id: MappingEntityTab; label: string }[] = [
  { id: "contact", label: "Contacts" },
  { id: "deal", label: "Deals" },
];

function MappingsSkeleton() {
  return (
    <div className="mt-6 space-y-4" aria-busy="true" aria-label="Loading mappings">
      <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-9 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-24 w-full animate-pulse rounded bg-slate-100" />
        </div>
        <div className="space-y-3 rounded-lg border border-slate-200 p-4">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
          <div className="h-9 w-full animate-pulse rounded bg-slate-100" />
          <div className="h-24 w-full animate-pulse rounded bg-slate-100" />
        </div>
      </div>
      <div className="h-32 w-full animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}

export function FieldMappingsShell({ tenantId }: { tenantId: string }) {
  const [entity, setEntity] = useState<MappingEntityTab>("contact");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), 250);
    return () => window.clearTimeout(timer);
  }, [entity]);

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
          Map Mindbody {entity === "contact" ? "client" : "deal"} fields to
          HubSpot properties. Read-only preview — editing comes in a later step.
        </p>

        {loading ? (
          <MappingsSkeleton />
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-8 text-center text-sm text-slate-500">
            <p className="font-medium text-slate-700">
              Catalogs and saved mappings will appear here.
            </p>
            <p className="mt-2">
              Tenant <span className="font-mono text-xs">{tenantId}</span> ·{" "}
              {entity === "contact" ? "contacts" : "deals"}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
