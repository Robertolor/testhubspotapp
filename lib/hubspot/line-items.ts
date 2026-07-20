const HS_BASE = "https://api.hubapi.com";

export interface HubspotLineItemProperties {
  name?: string;
  description?: string;
  quantity?: string;
  price?: string;
  amount?: string;
  mindbody_line_item_key?: string;
  mindbody_sale_id?: string;
  [key: string]: string | undefined;
}

async function hubspotFetch(
  accessToken: string,
  path: string,
  init?: RequestInit
): Promise<Response> {
  return fetch(`${HS_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

function sanitizeProps(
  props: Record<string, string | undefined>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(props)) {
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return out;
}

export async function searchLineItemByMindbodyKey(
  accessToken: string,
  lineItemKey: string
): Promise<string | null> {
  const res = await hubspotFetch(accessToken, `/crm/v3/objects/line_items/search`, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "mindbody_line_item_key",
              operator: "EQ",
              value: lineItemKey,
            },
          ],
        },
      ],
      limit: 1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.warn(
      `[hubspot] line item search failed for mindbody_line_item_key=${lineItemKey}: ${res.status} ${body}`
    );
    return null;
  }

  const data = (await res.json()) as { results: { id: string }[] };
  return data.results[0]?.id ?? null;
}

export async function createLineItem(
  accessToken: string,
  properties: HubspotLineItemProperties,
  dealId?: string
): Promise<string> {
  const associations = dealId
    ? [
        {
          to: { id: dealId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 20,
            },
          ],
        },
      ]
    : undefined;

  const res = await hubspotFetch(accessToken, `/crm/v3/objects/line_items`, {
    method: "POST",
    body: JSON.stringify({
      properties: sanitizeProps(properties),
      associations,
    }),
  });

  if (!res.ok) {
    throw new Error(`HubSpot create line item failed: ${await res.text()}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function updateLineItem(
  accessToken: string,
  lineItemId: string,
  properties: HubspotLineItemProperties
): Promise<void> {
  const res = await hubspotFetch(
    accessToken,
    `/crm/v3/objects/line_items/${lineItemId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ properties: sanitizeProps(properties) }),
    }
  );

  if (!res.ok) {
    throw new Error(`HubSpot update line item failed: ${await res.text()}`);
  }
}

/** Line item → deal (HubSpot-defined type 20). */
export async function associateLineItemToDeal(
  accessToken: string,
  lineItemId: string,
  dealId: string
): Promise<void> {
  const res = await hubspotFetch(
    accessToken,
    `/crm/v4/objects/line_items/${lineItemId}/associations/deals/${dealId}`,
    {
      method: "PUT",
      body: JSON.stringify([
        {
          associationCategory: "HUBSPOT_DEFINED",
          associationTypeId: 20,
        },
      ]),
    }
  );

  if (!res.ok && res.status !== 409) {
    throw new Error(
      `HubSpot associate line item to deal failed: ${await res.text()}`
    );
  }
}
