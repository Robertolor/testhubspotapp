import { getHubspotAppId } from "@/lib/hubspot/config";
import { HUBSPOT_WEBHOOK_EVENTS } from "@/lib/hubspot/config";
import { getAppUrl } from "@/lib/utils";

export async function ensureHubspotWebhookSubscriptions(
  accessToken: string,
  portalId: number
): Promise<void> {
  const appId = getHubspotAppId();
  const targetUrl = `${getAppUrl()}/api/webhooks/hubspot`;

  const listRes = await fetch(
    `https://api.hubapi.com/webhooks/v3/${appId}/subscriptions`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let existing: { id: string; eventType: string; active: boolean }[] = [];
  if (listRes.ok) {
    const listData = (await listRes.json()) as {
      results?: { id: string; eventType: string; active: boolean }[];
    };
    existing = listData.results ?? [];
  }

  for (const eventType of HUBSPOT_WEBHOOK_EVENTS) {
    const hasActive = existing.some(
      (s) => s.eventType === eventType && s.active
    );
    if (hasActive) continue;

    const res = await fetch(
      `https://api.hubapi.com/webhooks/v3/${appId}/subscriptions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          eventType,
          active: true,
          webhookUrl: targetUrl,
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.warn(
        `HubSpot webhook subscribe ${eventType} for portal ${portalId}: ${text}`
      );
    }
  }
}
