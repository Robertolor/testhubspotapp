import { encryptSecret } from "@/lib/crypto/secrets";
import { getSupabase } from "@/lib/db/client";
import {
  getMindbodyDeveloperApiKey,
  MINDBODY_WEBHOOKS_API,
  MINDBODY_WEBHOOK_EVENTS,
} from "@/lib/mindbody/config";
import { getAppUrl } from "@/lib/utils";

interface SubscriptionResponse {
  id?: string;
  subscriptionId?: string;
  SubscriptionId?: string;
  messageSignatureKey?: string;
  MessageSignatureKey?: string;
  status?: string;
  Status?: string;
  webhookUrl?: string;
  eventIds?: string[];
}

function subscriptionIdFrom(data: SubscriptionResponse): string {
  const id = data.SubscriptionId ?? data.subscriptionId ?? data.id;
  if (!id) {
    throw new Error("Mindbody subscription response missing id");
  }
  return id;
}

function messageSignatureKeyFrom(data: SubscriptionResponse): string | undefined {
  return data.MessageSignatureKey ?? data.messageSignatureKey;
}

async function remoteSubscriptionIsActive(
  subscriptionId: string,
  apiKey: string
): Promise<boolean> {
  const res = await fetch(
    `${MINDBODY_WEBHOOKS_API}/subscriptions/${subscriptionId}`,
    { headers: { "API-Key": apiKey } }
  );
  if (!res.ok) return false;

  const data = (await res.json()) as SubscriptionResponse;
  const status = data.Status ?? data.status;
  return status === "Active";
}

export async function ensureMindbodyWebhookSubscription(
  tenantId: string,
  _siteId: number
): Promise<void> {
  const webhookUrl = `${getAppUrl()}/api/webhooks/mindbody`;
  const apiKey = getMindbodyDeveloperApiKey();

  const { data: existing } = await getSupabase()
    .from("mindbody_webhook_subscriptions")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (existing?.status === "active" && existing.subscription_id) {
    const stillActive = await remoteSubscriptionIsActive(
      existing.subscription_id,
      apiKey
    );
    if (stillActive) {
      return;
    }

    await fetch(
      `${MINDBODY_WEBHOOKS_API}/subscriptions/${existing.subscription_id}`,
      { method: "DELETE", headers: { "API-Key": apiKey } }
    );
    await getSupabase()
      .from("mindbody_webhook_subscriptions")
      .delete()
      .eq("tenant_id", tenantId);
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
  const subscriptionId = subscriptionIdFrom(sub);

  const patchRes = await fetch(
    `${MINDBODY_WEBHOOKS_API}/subscriptions/${subscriptionId}`,
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
    messageSignatureKeyFrom(activated) ?? messageSignatureKeyFrom(sub);
  if (!sigKey) {
    throw new Error("Mindbody subscription response missing message signature key");
  }

  await getSupabase().from("mindbody_webhook_subscriptions").upsert(
    {
      tenant_id: tenantId,
      subscription_id: subscriptionId,
      message_signature_key_encrypted: encryptSecret(sigKey),
      webhook_url: webhookUrl,
      event_ids: [...MINDBODY_WEBHOOK_EVENTS],
      status: "active",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  );
}
