import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { getSupabase } from "../lib/db/client";
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

async function main(): Promise<void> {
  loadEnvLocal();
  const apiKey = getMindbodyDeveloperApiKey();
  const supabase = getSupabase();

  const { data: account } = await supabase
    .from("mindbody_accounts")
    .select("tenant_id, site_id, staff_username, updated_at")
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();
  console.log("mindbody_accounts:", account);

  const { data: sub } = await supabase
    .from("mindbody_webhook_subscriptions")
    .select("*")
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();
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

  const { data: deliveries } = await supabase
    .from("webhook_deliveries")
    .select("id, status, created_at, idempotency_key, error_message, processed_at")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(5);
  console.log("\nlatest tenant deliveries:", deliveries);

  const { data: settings } = await supabase
    .from("sync_settings")
    .select(
      "contacts_enabled, contacts_direction, deals_enabled, deals_direction, line_items_enabled"
    )
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();
  console.log("\nsync_settings:", settings);

  const { data: runs } = await supabase
    .from("sync_runs")
    .select("id, status, trigger, created_at, error_message")
    .eq("tenant_id", TENANT_ID)
    .order("created_at", { ascending: false })
    .limit(3);
  console.log("\nlatest sync_runs:", runs);

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
