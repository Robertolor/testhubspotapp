import {
  getHubspotAppId,
  HUBSPOT_WEBHOOK_SUBSCRIPTIONS,
} from "@/lib/hubspot/config";

type SubscriptionRow = {
  id?: string | number;
  eventType: string;
  propertyName?: string | null;
  active: boolean;
};

function subscriptionKey(eventType: string, propertyName?: string | null): string {
  return `${eventType}::${propertyName ?? ""}`;
}

function parseSubscriptionList(payload: unknown): SubscriptionRow[] {
  if (Array.isArray(payload)) return payload as SubscriptionRow[];
  if (payload && typeof payload === "object" && "results" in payload) {
    const results = (payload as { results?: SubscriptionRow[] }).results;
    return results ?? [];
  }
  return [];
}

export async function listHubspotWebhookSubscriptions(
  accessToken: string
): Promise<{ ok: boolean; status: number; subscriptions: SubscriptionRow[]; body: string }> {
  const appId = getHubspotAppId();
  const res = await fetch(
    `https://api.hubapi.com/webhooks/v3/${appId}/subscriptions`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const body = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, subscriptions: [], body };
  }
  try {
    return {
      ok: true,
      status: res.status,
      subscriptions: parseSubscriptionList(JSON.parse(body) as unknown),
      body,
    };
  } catch {
    return { ok: false, status: res.status, subscriptions: [], body };
  }
}

export async function ensureHubspotWebhookSubscriptions(
  accessToken: string,
  portalId: number
): Promise<{ created: string[]; skipped: string[]; failed: string[] }> {
  const appId = getHubspotAppId();
  const listed = await listHubspotWebhookSubscriptions(accessToken);
  const created: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  if (!listed.ok) {
    console.warn(
      `HubSpot webhook list for portal ${portalId}: ${listed.status} ${listed.body}`
    );
    return {
      created,
      skipped,
      failed: HUBSPOT_WEBHOOK_SUBSCRIPTIONS.map((item) =>
        subscriptionKey(item.eventType, item.propertyName)
      ),
    };
  }

  const existingKeys = new Set(
    listed.subscriptions
      .filter((row) => row.active)
      .map((row) => subscriptionKey(row.eventType, row.propertyName))
  );

  for (const item of HUBSPOT_WEBHOOK_SUBSCRIPTIONS) {
    const key = subscriptionKey(item.eventType, item.propertyName);
    if (existingKeys.has(key)) {
      skipped.push(key);
      continue;
    }

    const res = await fetch(
      `https://api.hubapi.com/webhooks/v3/${appId}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventType: item.eventType,
          active: true,
          ...(item.propertyName ? { propertyName: item.propertyName } : {}),
        }),
      }
    );

    if (res.ok) {
      created.push(key);
      continue;
    }
    const text = await res.text();
    failed.push(`${key} (${res.status})`);
    console.warn(
      `HubSpot webhook subscribe ${key} for portal ${portalId}: ${text}`
    );
  }

  return { created, skipped, failed };
}
