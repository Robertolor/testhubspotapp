import { encryptSecret } from "@/lib/crypto/secrets";
import { getSupabase } from "@/lib/db/client";
import {
  getMindbodyDeveloperApiKey,
  MINDBODY_WEBHOOKS_API,
  MINDBODY_WEBHOOK_EVENTS,
} from "@/lib/mindbody/config";
import { getAppUrl } from "@/lib/utils";

interface SubscriptionResponse {
  id: string;
  messageSignatureKey: string;
  status: string;
  webhookUrl: string;
  eventIds: string[];
}

export async function ensureMindbodyWebhookSubscription(
  tenantId: string,
  siteId: number
): Promise<void> {
  const webhookUrl = `${getAppUrl()}/api/webhooks/mindbody`;
  const apiKey = getMindbodyDeveloperApiKey();

  const { data: existing } = await getSupabase()
    .from("mindbody_webhook_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing?.status === "active") {
    return;
  }

  const createRes = await fetch(`${MINDBODY_WEBHOOKS_API}/subscriptions`, {
    method: "POST",
    headers: {
      "API-Key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      eventIds: [...MINDBODY_WEBHOOK_EVENTS],
      eventSchemaVersion: 1,
      referenceId: `tenant-${tenantId}`,
      webhookUrl,
    }),
  });

  if (!createRes.ok) {
    throw new Error(
      `Mindbody subscription create failed: ${await createRes.text()}`
    );
  }

  const sub = (await createRes.json()) as SubscriptionResponse;

  const patchRes = await fetch(
    `${MINDBODY_WEBHOOKS_API}/subscriptions/${sub.id}`,
    {
      method: "PATCH",
      headers: {
        "API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        Status: "Active",
        webhookUrl,
        eventIds: [...MINDBODY_WEBHOOK_EVENTS],
      }),
    }
  );

  if (!patchRes.ok) {
    throw new Error(
      `Mindbody subscription activate failed: ${await patchRes.text()}`
    );
  }

  const activated = (await patchRes.json()) as SubscriptionResponse;
  const sigKey =
    activated.messageSignatureKey || sub.messageSignatureKey;

  await getSupabase().from("mindbody_webhook_subscriptions").upsert(
    {
      tenant_id: tenantId,
      subscription_id: sub.id,
      message_signature_key_encrypted: encryptSecret(sigKey),
      webhook_url: webhookUrl,
      event_ids: [...MINDBODY_WEBHOOK_EVENTS],
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );
}
