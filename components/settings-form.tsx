"use client";

import { useEffect, useMemo, useState } from "react";
import { ActionFeedback } from "@/components/ui/action-feedback";
import { BillingRequiredNotice } from "@/components/billing-required-notice";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  DEAL_STAGE_MAPPING_CATALOG,
  type DealStageMappingKey,
} from "@/lib/sync/deal-stage-mappings";
import type { DealStageMappings } from "@/lib/db/types";

type SyncDirection = "mb_to_hs" | "hs_to_mb" | "bidirectional";

type PendingAction =
  | "saveCredentials"
  | "saveSync"
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
    sync_cutoff_date?: string | null;
    sync_cutoff_auto_advance?: boolean;
    appointments_enabled?: boolean;
    visits_enabled?: boolean;
    line_items_enabled?: boolean;
    assoc_deal_to_contact?: boolean;
    assoc_line_item_to_deal?: boolean;
    assoc_purchase_to_contract?: boolean;
    deals_pipeline_id?: string | null;
    deal_stage_mappings?: DealStageMappings;
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
    lower.includes("required") ||
    lower.includes("invalid") ||
    lower.includes("denied")
  );
}

function formatUserFacingError(text: string): string {
  const trimmed = text.trim();
  try {
    const parsed = JSON.parse(trimmed) as {
      Error?: { Message?: string };
      error?: string;
      message?: string;
    };
    const message =
      parsed.Error?.Message ?? parsed.error ?? parsed.message ?? trimmed;
    return humanizeMindbodyMessage(message);
  } catch {
    return humanizeMindbodyMessage(trimmed);
  }
}

function humanizeMindbodyMessage(message: string): string {
  if (/mindbody_accounts_site_id_key/i.test(message)) {
    return "This Mindbody site is still locked to one portal in the database. Run the shared-site update, then save again.";
  }
  if (/invalid api key/i.test(message)) {
    return "Mindbody rejected the API key. Check the key and try again.";
  }
  if (/deniedaccess/i.test(message)) {
    return "Mindbody denied access. Check the Site ID, API key, and staff login.";
  }
  return message;
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
  const [syncCutoffDate, setSyncCutoffDate] = useState("");
  const [syncCutoffAutoAdvance, setSyncCutoffAutoAdvance] = useState(false);
  const [appointmentsEnabled, setAppointmentsEnabled] = useState(false);
  const [visitsEnabled, setVisitsEnabled] = useState(false);
  const [lineItemsEnabled, setLineItemsEnabled] = useState(false);
  const [assocDealToContact, setAssocDealToContact] = useState(true);
  const [assocLineItemToDeal, setAssocLineItemToDeal] = useState(false);
  const [assocPurchaseToContract, setAssocPurchaseToContract] = useState(false);
  const [dealsPipelineId, setDealsPipelineId] = useState("");
  const [dealStageMappings, setDealStageMappings] = useState<DealStageMappings>(
    {}
  );
  const [pipelineOptions, setPipelineOptions] = useState<HubspotPipelineOption[]>(
    []
  );
  const [pipelinesLoading, setPipelinesLoading] = useState(false);
  const [pipelinesError, setPipelinesError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [credentialsSaveSucceeded, setCredentialsSaveSucceeded] = useState(false);
  const [syncSaveSucceeded, setSyncSaveSucceeded] = useState(false);
  const [mindbodyFeedback, setMindbodyFeedback] = useState<string | null>(null);
  const [mindbodyFeedbackIsError, setMindbodyFeedbackIsError] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);
  const [testSyncFeedback, setTestSyncFeedback] = useState<string | null>(null);
  const [testSyncNeedsBilling, setTestSyncNeedsBilling] = useState(false);
  const [backfillFeedback, setBackfillFeedback] = useState<string | null>(null);
  const [backfillNeedsBilling, setBackfillNeedsBilling] = useState(false);
  const [editingCredentials, setEditingCredentials] = useState(false);

  const actionBusy = pendingAction !== null;
  const mindbodyReady = Boolean(
    data?.mindbody?.configured &&
      data.mindbody.staffConfigured &&
      data.mindbody.staffPasswordConfigured
  );
  const showCredentialForm = !mindbodyReady || editingCredentials;
  const hubspotConnected = Boolean(data?.hubspot);
  const pipelineOptionsForUi = useMemo(
    () => (hubspotConnected ? pipelineOptions : []),
    [hubspotConnected, pipelineOptions]
  );

  const selectedPipeline = useMemo(
    () => pipelineOptionsForUi.find((pipeline) => pipeline.id === dealsPipelineId),
    [pipelineOptionsForUi, dealsPipelineId]
  );

  const stageMappingGroups = useMemo(() => {
    const groups = new Map<string, typeof DEAL_STAGE_MAPPING_CATALOG>();
    for (const entry of DEAL_STAGE_MAPPING_CATALOG) {
      const list = groups.get(entry.group) ?? [];
      list.push(entry);
      groups.set(entry.group, list);
    }
    return groups;
  }, []);

  function setStageMapping(key: DealStageMappingKey, stageId: string) {
    setDealStageMappings((prev) => {
      const next = { ...prev };
      if (stageId) next[key] = stageId;
      else delete next[key];
      return next;
    });
  }

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
          setSyncCutoffDate(d.settings.sync_cutoff_date ?? "");
          setSyncCutoffAutoAdvance(
            d.settings.sync_cutoff_auto_advance ?? false
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
          setDealStageMappings(d.settings.deal_stage_mappings ?? {});
        }
        if (d.mindbody?.siteId) setSiteId(String(d.mindbody.siteId));
        if (d.mindbody?.staffUsername) setStaffUsername(d.mindbody.staffUsername);
      });
  }, [tenantId]);

  useEffect(() => {
    if (!hubspotConnected) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
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
    });

    return () => {
      cancelled = true;
    };
  }, [tenantId, hubspotConnected]);

  useEffect(() => {
    if (!credentialsSaveSucceeded) return;
    const timer = window.setTimeout(
      () => setCredentialsSaveSucceeded(false),
      2000
    );
    return () => window.clearTimeout(timer);
  }, [credentialsSaveSucceeded]);

  useEffect(() => {
    if (!syncSaveSucceeded) return;
    const timer = window.setTimeout(() => setSyncSaveSucceeded(false), 2000);
    return () => window.clearTimeout(timer);
  }, [syncSaveSucceeded]);

  async function putSettings(body: unknown): Promise<void> {
    const res = await fetch(`/api/tenants/${tenantId}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
  }

  async function refreshSettings(): Promise<void> {
    const refreshed = await fetch(`/api/tenants/${tenantId}/settings`).then(
      (r) => r.json() as Promise<SettingsData>
    );
    setData(refreshed);
    if (refreshed.mindbody?.siteId) {
      setSiteId(String(refreshed.mindbody.siteId));
    }
    if (refreshed.mindbody?.staffUsername) {
      setStaffUsername(refreshed.mindbody.staffUsername);
    }
  }

  async function saveCredentials() {
    setPendingAction("saveCredentials");
    setMindbodyFeedback(null);
    setMindbodyFeedbackIsError(false);
    setCredentialsSaveSucceeded(false);
    try {
      if (!siteId.trim()) {
        throw new Error("Enter a Mindbody Site ID.");
      }
      const needsMindbodySetup =
        !data?.mindbody?.staffPasswordConfigured ||
        !data?.mindbody?.staffConfigured;
      if (
        needsMindbodySetup &&
        (!staffUsername.trim() || !staffPassword.trim())
      ) {
        throw new Error(
          "Enter the staff email and password, then save the connection."
        );
      }
      if (needsMindbodySetup && !apiKey.trim() && !data?.mindbody?.configured) {
        throw new Error("Paste the Mindbody API key, then save the connection.");
      }

      await putSettings({
        mindbody: {
          siteId: Number(siteId),
          ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          ...(staffUsername.trim() ? { staffUsername: staffUsername.trim() } : {}),
          ...(staffPassword.trim() ? { staffPassword: staffPassword.trim() } : {}),
        },
      });

      setCredentialsSaveSucceeded(true);
      setMindbodyFeedbackIsError(false);
      setMindbodyFeedback("Mindbody connection saved.");
      setApiKey("");
      setStaffPassword("");
      setEditingCredentials(false);
      await refreshSettings();
    } catch (e) {
      setMindbodyFeedbackIsError(true);
      setMindbodyFeedback(
        formatUserFacingError(e instanceof Error ? e.message : "Save failed")
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function saveSyncSettings() {
    setPendingAction("saveSync");
    setSyncFeedback(null);
    setSyncSaveSucceeded(false);
    try {
      const trimmedMin = purchasesMinAmount.trim();
      let parsedMin: number | null = null;
      if (trimmedMin) {
        parsedMin = Number(trimmedMin);
        if (!Number.isFinite(parsedMin) || parsedMin < 0) {
          throw new Error(
            "Minimum purchase amount must be a non-negative number."
          );
        }
      }

      await putSettings({
        sync: {
          contactsEnabled,
          contactsDirection,
          dealsEnabled,
          dealsDirection,
          purchasesMinAmount: parsedMin,
          syncCutoffDate: syncCutoffDate.trim() || null,
          syncCutoffAutoAdvance,
          appointmentsEnabled,
          visitsEnabled,
          lineItemsEnabled,
          assocDealToContact,
          assocLineItemToDeal,
          assocPurchaseToContract,
          dealsPipelineId: dealsPipelineId.trim() || null,
          dealStageMappings,
        },
      });

      setSyncSaveSucceeded(true);
      setSyncFeedback("Sync options saved.");
      await refreshSettings();
    } catch (e) {
      setSyncFeedback(
        formatUserFacingError(e instanceof Error ? e.message : "Save failed")
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function runBackfill(entityType: "contact" | "deal") {
    const key = entityType === "contact" ? "backfillContact" : "backfillDeal";
    setPendingAction(key);
    setBackfillFeedback(null);
    setBackfillNeedsBilling(false);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/sync/full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType }),
      });
      const text = await res.text();
      let json: { message?: string; error?: string; billingPath?: string } = {};
      if (text) {
        try {
          json = JSON.parse(text) as {
            message?: string;
            error?: string;
            billingPath?: string;
          };
        } catch {
          throw new Error(
            res.ok
              ? "Unexpected server response"
              : `Server error (${res.status})`
          );
        }
      }
      if (!res.ok) {
        if (res.status === 402) {
          setBackfillNeedsBilling(true);
          setBackfillFeedback(
            json.error ?? "Billing is not set up yet. Start a trial to sync."
          );
          return;
        }
        throw new Error(json.error ?? `Server error (${res.status})`);
      }
      setBackfillFeedback(
        json.message ??
          `Started a full ${entityType} sync. Check Reports for progress.`
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
    setTestSyncNeedsBilling(false);
    try {
      const res = await fetch(`/api/tenants/${tenantId}/sync/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType }),
      });
      const text = await res.text();
      let json: { message?: string; error?: string; billingPath?: string } = {};
      if (text) {
        try {
          json = JSON.parse(text) as {
            message?: string;
            error?: string;
            billingPath?: string;
          };
        } catch {
          throw new Error(
            res.ok
              ? "Unexpected server response"
              : `Server error (${res.status})`
          );
        }
      }
      if (!res.ok) {
        if (res.status === 402) {
          setTestSyncNeedsBilling(true);
          setTestSyncFeedback(
            json.error ?? "Billing is not set up yet. Start a trial to sync."
          );
          return;
        }
        throw new Error(json.error ?? `Server error (${res.status})`);
      }
      setTestSyncFeedback(
        json.message ?? "Started a small sync. Check Reports for progress."
      );
    } catch (e) {
      setTestSyncFeedback(
        e instanceof Error ? e.message : "Could not start the sync"
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
            Connected · HubSpot {data.hubspot.portalId}
            {data.hubspot.hubDomain ? ` · ${data.hubspot.hubDomain}` : ""}
          </p>
        </Card>
      )}

      <Card>
        <CardTitle>Mindbody</CardTitle>
        {mindbodyReady && !showCredentialForm ? (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Connected · Site {data?.mindbody?.siteId}
              {data?.mindbody?.staffUsername
                ? ` · ${data.mindbody.staffUsername}`
                : ""}
            </p>
            {mindbodyFeedback ? (
              <ActionFeedback
                type={mindbodyFeedbackIsError ? "error" : "success"}
                className="mt-3"
              >
                {mindbodyFeedback}
              </ActionFeedback>
            ) : null}
            <div className="mt-4">
              <Button
                variant="secondary"
                  onClick={() => {
                    setMindbodyFeedback(null);
                    setMindbodyFeedbackIsError(false);
                    setEditingCredentials(true);
                  }}
                disabled={actionBusy}
              >
                Update connection
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-1 text-sm text-slate-500">
              {mindbodyReady
                ? "Change the site ID, API key, or staff login. Leave API key and password blank to keep the current ones."
                : "Enter the Mindbody site ID, API key, and a staff login that is allowed to use the API."}
            </p>
            {data?.mindbody?.configured && !mindbodyReady ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium">Staff login still needed</p>
                <p className="mt-1 text-xs">
                  Site ID and API key are saved. Add the staff email and
                  password to finish connecting.
                </p>
              </div>
            ) : null}
            {mindbodyFeedback ? (
              <ActionFeedback
                type={mindbodyFeedbackIsError ? "error" : "success"}
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
                  placeholder="Your Mindbody site ID"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">API key</span>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder={
                    data?.mindbody?.configured ? "Leave blank to keep" : "Paste API key"
                  }
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-slate-700">
                  Staff email
                </span>
                <input
                  type="email"
                  value={staffUsername}
                  onChange={(e) => setStaffUsername(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder="Staff email with API access"
                />
              </label>
              <label className="block text-sm sm:col-span-2">
                <span className="font-medium text-slate-700">Staff password</span>
                <input
                  type="password"
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
                  placeholder={
                    data?.mindbody?.staffPasswordConfigured
                      ? "Leave blank to keep"
                      : "Staff account password"
                  }
                />
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                onClick={saveCredentials}
                loading={pendingAction === "saveCredentials"}
                success={credentialsSaveSucceeded}
                disabled={actionBusy && pendingAction !== "saveCredentials"}
              >
                {pendingAction === "saveCredentials"
                  ? "Saving…"
                  : "Save connection"}
              </Button>
              {mindbodyReady ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditingCredentials(false);
                    setApiKey("");
                    setStaffPassword("");
                    setMindbodyFeedback(null);
                    if (data?.mindbody?.siteId) {
                      setSiteId(String(data.mindbody.siteId));
                    }
                    if (data?.mindbody?.staffUsername) {
                      setStaffUsername(data.mindbody.staffUsername);
                    }
                  }}
                  disabled={actionBusy}
                >
                  Cancel
                </Button>
              ) : null}
            </div>
          </>
        )}
      </Card>

      <Card className="border-l-4 border-l-brand-accent">
        <CardTitle>Try a small sync</CardTitle>
        <p className="mt-1 text-sm text-slate-600">
          Copies up to <strong>20</strong> contacts or deals from Mindbody to
          HubSpot. If you set a cutoff date below, only newer records are
          included. Watch progress in Reports.
        </p>
        {testSyncNeedsBilling ? (
          <BillingRequiredNotice className="mt-3" />
        ) : testSyncFeedback ? (
          <ActionFeedback
            type={isErrorMessage(testSyncFeedback) ? "error" : "success"}
            className="mt-3"
          >
            {testSyncFeedback}
          </ActionFeedback>
        ) : !mindbodyReady ? (
          <p className="mt-3 text-sm text-slate-700">
            Save your Mindbody connection first. Then you can run a sync.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => runTestSync("contact")}
            loading={pendingAction === "testContact"}
            disabled={
              !mindbodyReady ||
              (actionBusy && pendingAction !== "testContact")
            }
          >
            {pendingAction === "testContact"
              ? "Starting…"
              : "Sync 20 contacts"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => runTestSync("deal")}
            loading={pendingAction === "testDeal"}
            disabled={
              !mindbodyReady || (actionBusy && pendingAction !== "testDeal")
            }
          >
            {pendingAction === "testDeal"
              ? "Starting…"
              : "Sync 20 deals"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>What to sync</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Mindbody contracts and sales become HubSpot deals.
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
            label="Deals (memberships & purchases)"
            enabled={dealsEnabled}
            onEnabledChange={setDealsEnabled}
            direction={dealsDirection}
            onDirectionChange={setDealsDirection}
          />

          <label className="block text-sm">
            <span className="font-medium text-slate-700">Deal pipeline</span>
            <select
              value={dealsPipelineId}
              onChange={(e) => setDealsPipelineId(e.target.value)}
              disabled={!data?.hubspot || pipelinesLoading}
              className="mt-1 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 disabled:bg-slate-100"
            >
              <option value="">
                {data?.hubspot
                  ? "Use HubSpot’s default pipeline"
                  : "Connect HubSpot to choose a pipeline"}
              </option>
              {pipelineOptionsForUi.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-slate-500">
              Choose which HubSpot pipeline new deals go into, then match each
              Mindbody status to a stage. Statuses you leave unmapped keep their
              current stage.
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
          </label>

          {dealsPipelineId && selectedPipeline ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-900">
                Pipeline stages
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Match Mindbody statuses to stages in{" "}
                <strong>{selectedPipeline.label}</strong>. Save this section
                after you change them.
              </p>
              <div className="mt-4 space-y-4">
                {[...stageMappingGroups.entries()].map(([group, entries]) => (
                  <div key={group}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {group}
                    </p>
                    <div className="mt-2 space-y-3">
                      {entries.map((entry) => (
                        <label key={entry.key} className="block text-sm">
                          <span className="font-medium text-slate-700">
                            {entry.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-slate-500">
                            {entry.hint}
                          </span>
                          <select
                            value={dealStageMappings[entry.key] ?? ""}
                            onChange={(e) =>
                              setStageMapping(
                                entry.key,
                                e.target.value
                              )
                            }
                            className="mt-1 w-full max-w-md rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                          >
                            <option value="">Not mapped</option>
                            {selectedPipeline.stages.map((stage) => (
                              <option key={stage.id} value={stage.id}>
                                {stage.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : dealsPipelineId ? (
            <p className="text-xs text-slate-500">
              Loading stages for the selected pipeline…
            </p>
          ) : null}
        </div>
        {syncFeedback ? (
          <ActionFeedback
            type={isErrorMessage(syncFeedback) ? "error" : "success"}
            className="mt-4"
          >
            {syncFeedback}
          </ActionFeedback>
        ) : null}
        <div className="mt-4">
          <Button
            onClick={saveSyncSettings}
            loading={pendingAction === "saveSync"}
            success={syncSaveSucceeded}
            disabled={actionBusy && pendingAction !== "saveSync"}
          >
            {pendingAction === "saveSync" ? "Saving…" : "Save what to sync"}
          </Button>
        </div>
      </Card>

      <Card>
        <CardTitle>Filters</CardTitle>
        <p className="mt-1 text-sm text-slate-500">
          Limit what gets copied, and turn extra record types on when you need
          them.
        </p>
        <div className="mt-4 space-y-4">
          <label className="block text-sm sm:max-w-xs">
            <span className="font-medium text-slate-700">
              Skip purchases below
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={purchasesMinAmount}
              onChange={(e) => setPurchasesMinAmount(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400"
              placeholder="No minimum"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Purchases at or below this amount are skipped. Leave empty to
              include every purchase.
            </span>
          </label>

          <label className="block text-sm sm:max-w-xs">
            <span className="font-medium text-slate-700">
              Only sync from this date
            </span>
            <input
              type="date"
              value={syncCutoffDate}
              onChange={(e) => setSyncCutoffDate(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Small syncs and full syncs only include Mindbody records on or
              after this date. Leave empty to include older history (uses more
              of your Mindbody API).
            </span>
          </label>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 sm:max-w-lg">
            <ToggleRow
              label="Move the cutoff forward after each sync"
              checked={syncCutoffAutoAdvance}
              onChange={setSyncCutoffAutoAdvance}
            />
            <p className="mt-2 text-xs text-slate-500">
              When this is on, a successful sync sets “Only sync from this date”
              to today. The next sync then skips older Mindbody history you
              already pulled, which uses less of your Mindbody API. Turn it off
              if you want to keep re-syncing from a fixed date.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-900">
              Extra record types
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Turn these on to include them when you sync deals.
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
            <p className="text-sm font-medium text-slate-900">Record links</p>
            <p className="mt-1 text-xs text-slate-500">
              Choose how related HubSpot records should be connected.
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
                    ? "Turn on line items above first"
                    : undefined
                }
              />
              <ToggleRow
                label="Link purchase deals to contract deals"
                checked={assocPurchaseToContract}
                onChange={setAssocPurchaseToContract}
                hint="Needs purchases and memberships to both sync"
              />
            </div>
          </div>
        </div>
        {syncFeedback ? (
          <ActionFeedback
            type={isErrorMessage(syncFeedback) ? "error" : "success"}
            className="mt-4"
          >
            {syncFeedback}
          </ActionFeedback>
        ) : null}
        <div className="mt-4">
          <Button
            onClick={saveSyncSettings}
            loading={pendingAction === "saveSync"}
            success={syncSaveSucceeded}
            disabled={actionBusy && pendingAction !== "saveSync"}
          >
            {pendingAction === "saveSync"
              ? "Saving…"
              : "Save filters"}
          </Button>
        </div>
      </Card>

      <details className="rounded-xl border border-slate-200 bg-white p-6">
        <summary className="cursor-pointer text-sm font-semibold text-slate-900">
          Advanced: sync everything
        </summary>
        <p className="mt-2 text-sm text-slate-600">
          Copies all matching records from Mindbody. This can take a while and
          uses more of your Mindbody API. For a first try, use the small sync
          above.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="secondary"
            onClick={() => runBackfill("contact")}
            loading={pendingAction === "backfillContact"}
            disabled={
              !mindbodyReady ||
              (actionBusy && pendingAction !== "backfillContact")
            }
          >
            {pendingAction === "backfillContact"
              ? "Starting…"
              : "Sync all contacts"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => runBackfill("deal")}
            loading={pendingAction === "backfillDeal"}
            disabled={
              !mindbodyReady ||
              (actionBusy && pendingAction !== "backfillDeal")
            }
          >
            {pendingAction === "backfillDeal"
              ? "Starting…"
              : "Sync all deals"}
          </Button>
        </div>
        {backfillNeedsBilling ? (
          <BillingRequiredNotice className="mt-3" />
        ) : backfillFeedback ? (
          <ActionFeedback
            type={isErrorMessage(backfillFeedback) ? "error" : "success"}
            className="mt-3"
          >
            {backfillFeedback}
          </ActionFeedback>
        ) : !mindbodyReady ? (
          <p className="mt-3 text-sm text-slate-700">
            Save your Mindbody connection first. Then you can run a sync.
          </p>
        ) : null}
      </details>
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
        <option value="bidirectional">Both ways</option>
      </select>
    </div>
  );
}
