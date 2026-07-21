/**
 * POST a signed test client.updated payload to the deployed webhook URL.
 * Usage: npx tsx scripts/send-test-mindbody-webhook.ts
 */
import { createHmac } from "crypto";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { decryptSecret } from "../lib/crypto/secrets";
import { getSupabase } from "../lib/db/client";

const TENANT_ID = "97a3b9c7-74c9-44ff-9201-eec8735e2154";
const WEBHOOK_URL = "https://testhubspotapp.vercel.app/api/webhooks/mindbody";

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

function sign(rawBody: string, key: string): string {
  const hmac = createHmac("sha256", key);
  hmac.update(rawBody, "utf8");
  return `sha256=${hmac.digest("base64")}`;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getSupabase();
  const { data: sub } = await supabase
    .from("mindbody_webhook_subscriptions")
    .select("message_signature_key_encrypted")
    .eq("tenant_id", TENANT_ID)
    .single();

  if (!sub?.message_signature_key_encrypted) {
    throw new Error("No subscription signature key in DB");
  }

  const sigKey = decryptSecret(sub.message_signature_key_encrypted);
  const messageId = `local-test-${Date.now()}`;
  const payload = {
    messageId,
    eventId: "client.updated",
    eventSchemaVersion: 1,
    siteId: -99,
    referenceId: `tenant-${TENANT_ID}`,
    eventData: {
      siteId: -99,
      clientId: "100014053",
    },
  };
  const rawBody = JSON.stringify(payload);
  const signature = sign(rawBody, sigKey);

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-mindbody-signature": signature,
    },
    body: rawBody,
  });

  console.log("POST status:", res.status);
  console.log("POST body:", await res.text());

  const { data: delivery } = await supabase
    .from("webhook_deliveries")
    .select("id, status, created_at, idempotency_key")
    .eq("idempotency_key", `-99-client.updated-${messageId}`)
    .maybeSingle();
  console.log("delivery row:", delivery);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
