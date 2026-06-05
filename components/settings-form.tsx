"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

type SyncDirection = "mb_to_hs" | "hs_to_mb" | "bidirectional";

interface SettingsData {
  settings?: {
    contacts_enabled: boolean;
    contacts_direction: SyncDirection;
    deals_enabled: boolean;
    deals_direction: SyncDirection;
  };
  mindbody?: { siteId?: number; configured: boolean };
  hubspot?: { portalId: number; hubDomain: string | null };
}

export function SettingsForm({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<SettingsData | null>(null);
  const [siteId, setSiteId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [contactsEnabled, setContactsEnabled] = useState(false);
  const [contactsDirection, setContactsDirection] =
    useState<SyncDirection>("mb_to_hs");
  const [dealsEnabled, setDealsEnabled] = useState(false);
  const [dealsDirection, setDealsDirection] =
    useState<SyncDirection>("mb_to_hs");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/tenants/${tenantId}/settings`)
      .then((r) => r.json())
      .then((d: SettingsData) => {
        setData(d);
        if (d.settings) {
          setContactsEnabled(d.settings.contacts_enabled);
          setContactsDirection(d.settings.contacts_direction);
          setDealsEnabled(d.settings.deals_enabled);
          setDealsDirection(d.settings.deals_direction);
        }
        if (d.mindbody?.siteId) setSiteId(String(d.mindbody.siteId));
      });
  }, [tenantId]);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mindbody:
            siteId && apiKey
              ? { siteId: Number(siteId), apiKey }
              : undefined,
          sync: {
            contactsEnabled,
            contactsDirection,
            dealsEnabled,
            dealsDirection,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed");
      setMessage("Settings saved.");
      setApiKey("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function runBackfill(entityType: "contact" | "deal") {
    setMessage(null);
    const res = await fetch(`/api/tenants/${tenantId}/sync/full`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entityType }),
    });
    const json = await res.json();
    setMessage(json.message ?? (res.ok ? "Backfill queued" : json.error));
  }

  return (
    <div className="space-y-6">
      {data?.hubspot && (
        <Card>
          <CardTitle>HubSpot</CardTitle>
          <p className="mt-2 text-sm text-slate-600">
            Portal {data.hubspot.portalId}
            {data.hubspot.hubDomain ? ` · ${data.hubspot.hubDomain}` : ""}
          </p>
        </Card>
      )}

      <Card>
        <CardTitle>Mindbody credentials</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Each client provides their Site ID and API key from Mindbody activation.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Site ID</span>
            <input
              type="number"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
              placeholder="e.g. 12345"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">API key</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
              placeholder={
                data?.mindbody?.configured ? "••••••••" : "Paste API key"
              }
            />
          </label>
        </div>
      </Card>

      <Card>
        <CardTitle>Sync direction</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Contracts and sales from Mindbody map to HubSpot deals.
        </p>
        <div className="mt-4 space-y-4">
          <SyncRow
            label="Contacts"
            enabled={contactsEnabled}
            onEnabledChange={setContactsEnabled}
            direction={contactsDirection}
            onDirectionChange={setContactsDirection}
          />
          <SyncRow
            label="Deals (contracts & sales)"
            enabled={dealsEnabled}
            onEnabledChange={setDealsEnabled}
            direction={dealsDirection}
            onDirectionChange={setDealsDirection}
          />
        </div>
      </Card>

      <div className="flex flex-wrap gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
        <Button variant="secondary" onClick={() => runBackfill("contact")}>
          Backfill contacts
        </Button>
        <Button variant="secondary" onClick={() => runBackfill("deal")}>
          Backfill deals
        </Button>
      </div>

      {message && (
        <p
          className={`text-sm ${message.includes("failed") || message.includes("error") ? "text-red-600" : "text-teal-700"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
}

function SyncRow({
  label,
  enabled,
  onEnabledChange,
  direction,
  onDirectionChange,
}: {
  label: string;
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  direction: SyncDirection;
  onDirectionChange: (v: SyncDirection) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg bg-slate-50 p-4">
      <label className="flex items-center gap-2 text-sm font-medium text-slate-900">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        {label}
      </label>
      <select
        value={direction}
        onChange={(e) => onDirectionChange(e.target.value as SyncDirection)}
        disabled={!enabled}
        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 disabled:opacity-50"
      >
        <option value="mb_to_hs">Mindbody → HubSpot</option>
        <option value="hs_to_mb">HubSpot → Mindbody</option>
        <option value="bidirectional">Bidirectional</option>
      </select>
    </div>
  );
}
