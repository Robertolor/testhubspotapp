/**
 * Diagnose Mindbody webhook subscription + recent deliveries.
 * Usage: npx tsx scripts/diagnose-mindbody-webhook.ts
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import {
  getMindbodyDeveloperApiKey,
  MINDBODY_WEBHOOKS_API,
} from "../lib/mindbody/config";

const TENANT_ID = "97a3b9c7-74c9-44ff-9201-eec8735e2154";

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function supabaseGet(
  table: string,
  query: string
): Promise<unknown> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=representation",
    },
  });
  if (!res.ok) {
    throw new Error(`${table} query failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

async function main(): Promise<void> {
  loadEnvLocal();
  const apiKey = getMindbodyDeveloperApiKey();

  const accounts = (await supabaseGet(
    "mindbody_accounts",
    `select=tenant_id,site_id,staff_username,updated_at&tenant_id=eq.${TENANT_ID}`
  )) as unknown[];
  console.log("mindbody_accounts:", accounts[0] ?? null);

  const subs = (await supabaseGet(
    "mindbody_webhook_subscriptions",
    `select=subscription_id,status,webhook_url,event_ids,updated_at&tenant_id=eq.${TENANT_ID}`
  )) as Array<{
    subscription_id?: string;
    status?: string;
    webhook_url?: string;
    event_ids?: string[];
    updated_at?: string;
  }>;
  const sub = subs[0];
  console.log("local subscription row:", {
    subscription_id: sub?.subscription_id,
    status: sub?.status,
    webhook_url: sub?.webhook_url,
    event_ids: sub?.event_ids,
    updated_at: sub?.updated_at,
  });

  if (sub?.subscription_id) {
    const res = await fetch(
      `${MINDBODY_WEBHOOKS_API}/subscriptions/${sub.subscription_id}`,
      { headers: { "API-Key": apiKey } }
    );
    console.log("Mindbody GET subscription status:", res.status);
    console.log(await res.text());
  }

  const listRes = await fetch(`${MINDBODY_WEBHOOKS_API}/subscriptions`, {
    headers: { "API-Key": apiKey },
  });
  console.log("\nMindbody list subscriptions status:", listRes.status);
  console.log(await listRes.text());

  const deliveries = await supabaseGet(
    "webhook_deliveries",
    `select=id,status,created_at,idempotency_key,error_message,processed_at&tenant_id=eq.${TENANT_ID}&order=created_at.desc&limit=5`
  );
  console.log("\nlatest tenant deliveries:", deliveries);

  const settings = (await supabaseGet(
    "sync_settings",
    `select=contacts_enabled,contacts_direction,deals_enabled,deals_direction,line_items_enabled&tenant_id=eq.${TENANT_ID}`
  )) as unknown[];
  console.log("\nsync_settings:", settings[0] ?? null);

  const metricsRes = await fetch(`${MINDBODY_WEBHOOKS_API}/metrics`, {
    headers: { "API-Key": apiKey },
  });
  console.log("\nMindbody metrics status:", metricsRes.status);
  console.log(await metricsRes.text());

  const headRes = await fetch(
    "https://testhubspotapp.vercel.app/api/webhooks/mindbody",
    { method: "HEAD" }
  );
  console.log("\nwebhook HEAD:", headRes.status);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
