"use client";

import { useEffect, useState } from "react";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";

type SyncDirection = "mb_to_hs" | "hs_to_mb" | "bidirectional";

type PendingAction =
  | "save"
  | "testContact"
  | "testDeal"
  | "backfillContact"
  | "backfillDeal"
  | null;

interface SettingsData {
  settings?: {
    contacts_enabled: boolean;
    contacts_direction: SyncDirection;
    deals_enabled: boolean;
    deals_direction: SyncDirection;
  };
  mindbody?: {
    siteId?: number;
    configured: boolean;
    staffUsername?: string;
    staffConfigured?: boolean;
    staffPasswordConfigured?: boolean;
  };
  hubspot?: { portalId: number; hubDomain: string | null };
}

function isErrorMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("fail") ||
    lower.includes("error") ||
    lower.includes("required")
  );
}

export function SettingsForm({ tenantId }: { tenantId: string }) {
  const [data, setData] = useState<SettingsData | null>(null);
  const [siteId, setSiteId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [staffUsername, setStaffUsername] = useState("");
  const [staffPassword, setStaffPassword] = useState("");
  const [contactsEnabled, setContactsEnabled] = useState(false);
  const [contactsDirection, setContactsDirection] =
    useState<SyncDirection>("mb_to_hs");
  const [dealsEnabled, setDealsEnabled] = useState(false);
  const [dealsDirection, setDealsDirection] =
    useState<SyncDirection>("mb_to_hs");
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [saveSucceeded, setSaveSucceeded] = useState(false);
  const [mindbodyFeedback, setMindbodyFeedback] = useState<string | null>(null);
  const [testSyncFeedback, setTestSyncFeedback] = useState<string | null>(null);
  const [backfillFeedback, setBackfillFeedback] = useState<string | null>(null);

  const actionBusy = pendingAction !== null;

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
        if (d.mindbody?.staffUsername) setStaffUsername(d.mindbody.staffUsername);
      });
  }, [tenantId]);

  useEffect(() => {
    if (!saveSucceeded) return;
    const timer = window.setTimeout(() => setSaveSucceeded(false), 2000);
    return () => window.clearTimeout(timer);
  }, [saveSucceeded]);

  async function save() {
    setPendingAction("save");
    setMindbodyFeedback(null);
    setSaveSucceeded(false);
    try {
      const savedStaffUsername = data?.mindbody?.staffUsername ?? "";
      const savedSiteId = data?.mindbody?.siteId
        ? String(data.mindbody.siteId)
        : "";
      const mindbodyCredentialsTouched =
        Boolean(apiKey) ||
        Boolean(staffPassword) ||
        staffUsername !== savedStaffUsername ||
        siteId !== savedSiteId;
      const needsMindbodySetup =
        !data?.mindbody?.staffPasswordConfigured ||
        !data?.mindbody?.staffConfigured;

      if (
        siteId &&
        needsMindbodySetup &&
        (!staffUsername.trim() || !staffPassword.trim())
      ) {
        throw new Error(
          "Enter staff username and password, then Save settings."
        );
      }

      const res = await fetch(`/api/tenants/${tenantId}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mindbody:
            siteId && (mindbodyCredentialsTouched || needsMindbodySetup)
              ? {
                  siteId: Number(siteId),
                  ...(apiKey ? { apiKey } : {}),
                  ...(staffUsername ? { staffUsername } : {}),
                  ...(staffPassword ? { staffPassword } : {}),
                }
              : undefined,
          sync: {
            contactsEnabled,
            contactsDirection,
            dealsEnabled,
            dealsDirection,
          },
        }),
      });
      const text = await res.text();
      let json: { error?: string; ok?: boolean } = {};
      if (text) {
        try {
          json = JSON.parse(text) as { error?: string; ok?: boolean };
        } catch {
          throw new Error(
            res.ok
              ? "Unexpected server response"
              : `Server error (${res.status})`
          );
        }
      } else if (!res.ok) {
        throw new Error(`Server error (${res.status})`);
      }
      if (!res.ok) throw new Error(json.error ?? "Save failed");

      setSaveSucceeded(true);
      setMindbodyFeedback("Settings saved.");
      setApiKey("");
      setStaffPassword("");
      const refreshed = await fetch(`/api/tenants/${tenantId}/settings`).then(
        (r) => r.json() as Promise<SettingsData>
      );
      setData(refreshed);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Save failed";
      setMindbodyFeedback(message);
    } finally {
      setPendingAction(null);
    }
  }

  async function runBackfill(entityType: "contact" | "deal") {
    const key = entityType === "contact" ? "backfillContact" : "backfillDeal";
    setPendingAction(key);
    setBackfillFeedback(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/sync/full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType }),
      });
      const text = await res.text();
      let json: { message?: string; error?: string } = {};
      if (text) {
        try {
          json = JSON.parse(text) as { message?: string; error?: string };
        } catch {
          throw new Error(
            res.ok
              ? "Unexpected server response"
              : `Server error (${res.status})`
          );
        }
      }
      if (!res.ok) {
        throw new Error(json.error ?? `Server error (${res.status})`);
      }
      setBackfillFeedback(
        json.message ??
          `Full ${entityType} backfill queued. Check Reports for progress.`
      );
    } catch (e) {
      setBackfillFeedback(
        e instanceof Error ? e.message : "Backfill failed to start"
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function runTestSync(entityType: "contact" | "deal") {
    const key = entityType === "contact" ? "testContact" : "testDeal";
    setPendingAction(key);
    setTestSyncFeedback(null);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/sync/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType }),
      });
      const text = await res.text();
      let json: { message?: string; error?: string } = {};
      if (text) {
        try {
          json = JSON.parse(text) as { message?: string; error?: string };
        } catch {
          throw new Error(
            res.ok
              ? "Unexpected server response"
              : `Server error (${res.status})`
          );
        }
      }
      if (!res.ok) {
        throw new Error(json.error ?? `Server error (${res.status})`);
      }
      setTestSyncFeedback(
        json.message ?? "Test sync started. Check Reports for progress."
      );
    } catch (e) {
      setTestSyncFeedback(
        e instanceof Error ? e.message : "Test sync failed to start"
      );
    } finally {
      setPendingAction(null);
    }
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
          Each business provides their Site ID, API key, and a staff login with
          API access permission.
        </p>
        {data?.mindbody?.configured ? (
          <div
            className={`mt-3 rounded-lg border px-4 py-3 text-sm ${
              data.mindbody.staffPasswordConfigured &&
              data.mindbody.staffConfigured
                ? "border-teal-200 bg-teal-50 text-teal-900"
                : "border-amber-200 bg-amber-50 text-amber-950"
            }`}
          >
            <p className="font-medium">
              {data.mindbody.staffPasswordConfigured &&
              data.mindbody.staffConfigured
                ? "Mindbody credentials saved"
                : "Mindbody staff login incomplete"}
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              <li>Site ID and API key — saved</li>
              <li>
                Staff username —{" "}
                {data.mindbody.staffConfigured
                  ? data.mindbody.staffUsername
                  : "not saved (required)"}
              </li>
              <li>
                Staff password —{" "}
                {data.mindbody.staffPasswordConfigured
                  ? "saved (hidden). Leave blank unless changing it."
                  : "not saved (required)"}
              </li>
            </ul>
          </div>
        ) : null}
        {mindbodyFeedback ? (
          <ActionFeedback
            type={isErrorMessage(mindbodyFeedback) ? "error" : "success"}
            className="mt-3"
          >
            {mindbodyFeedback}
          </ActionFeedback>
        ) : null}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Site ID</span>
            <input
              type="number"
              value={siteId}
              onChange={(e) => setSiteId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
              placeholder="e.g. 12345 or -99 for sandbox"
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
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">
              Staff username (email)
            </span>
            <input
              type="email"
              value={staffUsername}
              onChange={(e) => setStaffUsername(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
              placeholder="Staff account with API permission"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="font-medium text-slate-700">Staff password</span>
            <input
              type="password"
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
              placeholder={
                data?.mindbody?.staffConfigured
                  ? "••••••••"
                  : "Staff account password"
              }
            />
          </label>
        </div>
        <div className="mt-4">
          <Button
            onClick={save}
            loading={pendingAction === "save"}
            success={saveSucceeded}
            disabled={actionBusy && pendingAction !== "save"}
          >
            {pendingAction === "save" ? "Saving…" : "Save settings"}
          </Button>
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

      <Card className="border-amber-200 bg-amber-50/50">
        <CardTitle>Sandbox test sync (temporary)</CardTitle>
        <p className="mt-1 text-sm text-slate-600">
          Syncs at most <strong>20</strong> contacts or deals from Mindbody for
          E2E validation. Detailed steps are logged in Reports and Vercel
          function logs. Use this instead of full backfill on shared sandbox
          site <code className="text-xs">-99</code>.
        </p>
        {testSyncFeedback ? (
          <ActionFeedback
            type={isErrorMessage(testSyncFeedback) ? "error" : "success"}
            className="mt-3"
          >
            {testSyncFeedback}
          </ActionFeedback>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => runTestSync("contact")}
            loading={pendingAction === "testContact"}
            disabled={actionBusy && pendingAction !== "testContact"}
          >
            {pendingAction === "testContact"
              ? "Starting…"
              : "Test sync contacts (20)"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => runTestSync("deal")}
            loading={pendingAction === "testDeal"}
            disabled={actionBusy && pendingAction !== "testDeal"}
          >
            {pendingAction === "testDeal"
              ? "Starting…"
              : "Test sync deals (20)"}
          </Button>
        </div>
      </Card>

      <div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => runBackfill("contact")}
            loading={pendingAction === "backfillContact"}
            disabled={actionBusy && pendingAction !== "backfillContact"}
          >
            {pendingAction === "backfillContact"
              ? "Queuing…"
              : "Full backfill contacts"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => runBackfill("deal")}
            loading={pendingAction === "backfillDeal"}
            disabled={actionBusy && pendingAction !== "backfillDeal"}
          >
            {pendingAction === "backfillDeal"
              ? "Queuing…"
              : "Full backfill deals"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Full backfill pulls all records — avoid on Mindbody sandbox.
        </p>
        {backfillFeedback ? (
          <ActionFeedback
            type={isErrorMessage(backfillFeedback) ? "error" : "success"}
            className="mt-3"
          >
            {backfillFeedback}
          </ActionFeedback>
        ) : null}
      </div>
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
