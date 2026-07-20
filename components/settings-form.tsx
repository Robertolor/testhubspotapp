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
    purchases_min_amount?: number | null;
    appointments_enabled?: boolean;
    visits_enabled?: boolean;
    line_items_enabled?: boolean;
    assoc_deal_to_contact?: boolean;
    assoc_line_item_to_deal?: boolean;
    assoc_purchase_to_contract?: boolean;
    deals_pipeline_id?: string | null;
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

interface HubspotPipelineOption {
  id: string;
  label: string;
  stages: { id: string; label: string }[];
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
  const [purchasesMinAmount, setPurchasesMinAmount] = useState("");
  const [appointmentsEnabled, setAppointmentsEnabled] = useState(false);
  const [visitsEnabled, setVisitsEnabled] = useState(false);
  const [lineItemsEnabled, setLineItemsEnabled] = useState(false);
  const [assocDealToContact, setAssocDealToContact] = useState(true);
  const [assocLineItemToDeal, setAssocLineItemToDeal] = useState(false);
  const [assocPurchaseToContract, setAssocPurchaseToContract] = useState(false);
  const [dealsPipelineId, setDealsPipelineId] = useState("");
  const [pipelineOptions, setPipelineOptions] = useState<HubspotPipelineOption[]>(
    []
  );
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [pipelinesError, setPipelinesError] = useState<string | null>(null);
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
          setPurchasesMinAmount(
            d.settings.purchases_min_amount != null
              ? String(d.settings.purchases_min_amount)
              : ""
          );
          setAppointmentsEnabled(d.settings.appointments_enabled ?? false);
          setVisitsEnabled(d.settings.visits_enabled ?? false);
          setLineItemsEnabled(d.settings.line_items_enabled ?? false);
          setAssocDealToContact(d.settings.assoc_deal_to_contact !== false);
          setAssocLineItemToDeal(d.settings.assoc_line_item_to_deal ?? false);
          setAssocPurchaseToContract(
            d.settings.assoc_purchase_to_contract ?? false
          );
          setDealsPipelineId(d.settings.deals_pipeline_id ?? "");
        }
        if (d.mindbody?.siteId) setSiteId(String(d.mindbody.siteId));
        if (d.mindbody?.staffUsername) setStaffUsername(d.mindbody.staffUsername);
      });
  }, [tenantId]);

  useEffect(() => {
    if (!data?.hubspot) {
      setPipelineOptions([]);
      setPipelinesError(null);
      return;
    }

    let cancelled = false;
    setPipelinesLoading(true);
    setPipelinesError(null);

    fetch(`/api/tenants/${tenantId}/hubspot/pipelines`)
      .then(async (res) => {
        const json = (await res.json()) as {
          pipelines?: HubspotPipelineOption[];
          error?: string;
        };
        if (!res.ok) {
          throw new Error(json.error ?? "Failed to load HubSpot pipelines");
        }
        if (!cancelled) {
          setPipelineOptions(json.pipelines ?? []);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setPipelineOptions([]);
          setPipelinesError(
            e instanceof Error ? e.message : "Failed to load HubSpot pipelines"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setPipelinesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId, data?.hubspot]);

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

      const trimmedMin = purchasesMinAmount.trim();
      let parsedMin: number | null = null;
      if (trimmedMin) {
        parsedMin = Number(trimmedMin);
        if (!Number.isFinite(parsedMin) || parsedMin < 0) {
          throw new Error("Minimum purchase amount must be a non-negative number.");
        }
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
            purchasesMinAmount: parsedMin,
            appointmentsEnabled,
            visitsEnabled,
            lineItemsEnabled,
            assocDealToContact,
            assocLineItemToDeal,
            assocPurchaseToContract,
            dealsPipelineId: dealsPipelineId.trim() || null,
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

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Default deal pipeline</span>
            <select
              value={dealsPipelineId}
              onChange={(e) => setDealsPipelineId(e.target.value)}
              disabled={!data?.hubspot || pipelinesLoading}
              className="mt-1 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100"
            >
              <option value="">
                {data?.hubspot
                  ? "HubSpot default (no pipeline set)"
                  : "Connect HubSpot to choose a pipeline"}
              </option>
              {pipelineOptions.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Synced deals land in this pipeline with a stage from Mindbody
              status (e.g. Attended, Scheduled, Active). Gritcity uses a
              dedicated pipeline with matching stage labels.
            </span>
            {pipelinesLoading ? (
              <span className="mt-1 block text-xs text-slate-500">
                Loading HubSpot pipelines…
              </span>
            ) : null}
            {pipelinesError ? (
              <span className="mt-1 block text-xs text-red-600">
                {pipelinesError}
              </span>
            ) : null}
            {dealsPipelineId && pipelineOptions.length > 0 ? (
              <span className="mt-1 block text-xs text-slate-500">
                Stages in this pipeline:{" "}
                {pipelineOptions
                  .find((pipeline) => pipeline.id === dealsPipelineId)
                  ?.stages.map((stage) => stage.label)
                  .join(", ") || "none"}
              </span>
            ) : null}
          </label>
        </div>
      </Card>

      <Card>
        <CardTitle>Runtime sync controls</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Turn features on or off without redeploying. New entity types stay
          inactive until sync ships — toggles save your preference for cutover.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block text-sm sm:max-w-xs">
            <span className="font-medium text-slate-700">
              Minimum purchase amount
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={purchasesMinAmount}
              onChange={(e) => setPurchasesMinAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
              placeholder="No minimum (sync all purchases)"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Purchases at or below this amount are skipped. Leave empty to
              sync all purchases (Gritcity uses 25).
            </span>
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">
              Expanded entities
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Appointments and visits sync via Test sync deals when enabled.
              Line items still map-only until sync ships.
            </p>
            <div className="mt-3 space-y-2">
              <ToggleRow
                label="Appointments"
                checked={appointmentsEnabled}
                onChange={setAppointmentsEnabled}
              />
              <ToggleRow
                label="Visits"
                checked={visitsEnabled}
                onChange={setVisitsEnabled}
              />
              <ToggleRow
                label="Line items"
                checked={lineItemsEnabled}
                onChange={setLineItemsEnabled}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">Associations</p>
            <p className="mt-1 text-xs text-slate-500">
              Control how HubSpot records link together during sync.
            </p>
            <div className="mt-3 space-y-2">
              <ToggleRow
                label="Link deals to contacts"
                checked={assocDealToContact}
                onChange={setAssocDealToContact}
              />
              <ToggleRow
                label="Link line items to purchase deals"
                checked={assocLineItemToDeal}
                onChange={setAssocLineItemToDeal}
                disabled={!lineItemsEnabled}
                hint={
                  !lineItemsEnabled
                    ? "Enable line items when sync is available"
                    : undefined
                }
              />
              <ToggleRow
                label="Link purchase deals to contract deals"
                checked={assocPurchaseToContract}
                onChange={setAssocPurchaseToContract}
                hint="Requires purchase and contract sync"
              />
            </div>
          </div>
        </div>
        <div className="mt-4">
          <Button
            onClick={save}
            loading={pendingAction === "save"}
            success={saveSucceeded}
            disabled={actionBusy && pendingAction !== "save"}
          >
            {pendingAction === "save" ? "Saving…" : "Save runtime controls"}
          </Button>
        </div>
      </Card>

      <Card className="border-slate-200 bg-slate-50/80">
        <CardTitle>Migration fallback</CardTitle>
        <p className="mt-1 text-sm text-slate-600">
          During expansion, use the local Mindbody migration CLI for full
          one-time loads. Keep app sync limited until cutover. Do not run both
          full syncs on the same HubSpot portal at once.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Out-of-order webhooks are handled by retrying pending deal-to-contact
          links when the contact sync lands.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          See <code className="text-xs">docs/RUNTIME_FALLBACK.md</code> for the
          cutover checklist.
        </p>
      </Card>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardTitle>Sandbox test sync (temporary)</CardTitle>
        <p className="mt-1 text-sm text-slate-600">
          Syncs at most <strong>20</strong> contacts or deals from Mindbody for
          E2E validation. Deal test sync reserves slots for each enabled type
          (sales/contracts, appointments, visits) so one type does not use the
          full cap. Visits scan up to 50 clients over the past year. Detailed
          steps are logged in Reports and Vercel function logs. Use this instead
          of full backfill on shared sandbox site{" "}
          <code className="text-xs">-99</code>.
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

function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label
        className={`flex items-center gap-2 text-sm font-medium text-slate-900 ${
          disabled ? "opacity-50" : ""
        }`}
      >
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      {hint ? <p className="mt-0.5 pl-6 text-xs text-slate-500">{hint}</p> : null}
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
