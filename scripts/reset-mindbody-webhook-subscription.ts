/**
 * Reset Mindbody webhook subscription and persist a fresh signature key.
 * Usage: npx tsx scripts/reset-mindbody-webhook-subscription.ts
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { getSupabase } from "../lib/db/client";
import { ensureMindbodyWebhookSubscription } from "../lib/mindbody/webhooks-subscribe";
import { getMindbodyDeveloperApiKey, MINDBODY_WEBHOOKS_API } from "../lib/mindbody/config";

const TENANT_ID = "97a3b9c7-74c9-44ff-9201-eec8735e2154";
const SITE_ID = -99;

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
  process.env.NEXT_PUBLIC_APP_URL = "https://testhubspotapp.vercel.app";
  const apiKey = getMindbodyDeveloperApiKey();
  const supabase = getSupabase();

  const { data: existing } = await supabase
    .from("mindbody_webhook_subscriptions")
    .select("subscription_id")
    .eq("tenant_id", TENANT_ID)
    .maybeSingle();

  if (existing?.subscription_id) {
    const delRes = await fetch(
      `${MINDBODY_WEBHOOKS_API}/subscriptions/${existing.subscription_id}`,
      { method: "DELETE", headers: { "API-Key": apiKey } }
    );
    console.log("Deleted Mindbody subscription:", delRes.status);
  }

  await supabase
    .from("mindbody_webhook_subscriptions")
    .delete()
    .eq("tenant_id", TENANT_ID);

  await ensureMindbodyWebhookSubscription(TENANT_ID, SITE_ID);

  const { data: saved } = await supabase
    .from("mindbody_webhook_subscriptions")
    .select("subscription_id, status, webhook_url")
    .eq("tenant_id", TENANT_ID)
    .single();

  console.log("Saved subscription:", saved);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
