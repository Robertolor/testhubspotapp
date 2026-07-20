const HS_BASE = "https://api.hubapi.com";

export interface HubspotContactProperties {
  email?: string;
  firstname?: string;
  lastname?: string;
  phone?: string;
  mindbody_client_id?: string;
  mindbody_site_id?: string;
  mindbody_last_synced_at?: string;
  [key: string]: string | undefined;
}

export interface HubspotDealProperties {
  dealname?: string;
  amount?: string;
  closedate?: string;
  pipeline?: string;
  dealstage?: string;
  mindbody_contract_id?: string;
  mindbody_sale_id?: string;
  mindbody_client_id?: string;
  deal_source?: string;
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

export async function upsertContact(
  accessToken: string,
  properties: HubspotContactProperties,
  email: string
): Promise<string> {
  const res = await hubspotFetch(
    accessToken,
    `/crm/v3/objects/contacts/batch/upsert`,
    {
      method: "POST",
      body: JSON.stringify({
        inputs: [
          {
            idProperty: "email",
            id: email,
            properties: sanitizeProps(properties),
          },
        ],
      }),
    }
  );

  if (!res.ok) {
    throw new Error(`HubSpot contact upsert failed: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    results: { id: string }[];
  };
  return data.results[0].id;
}

export async function getContact(
  accessToken: string,
  contactId: string,
  properties?: string[]
): Promise<Record<string, string>> {
  const params = properties?.length
    ? `?properties=${properties.join(",")}`
    : "";
  const res = await hubspotFetch(
    accessToken,
    `/crm/v3/objects/contacts/${contactId}${params}`
  );
  if (!res.ok) throw new Error(`HubSpot get contact failed: ${await res.text()}`);
  const data = (await res.json()) as { properties: Record<string, string> };
  return data.properties;
}

export async function createContact(
  accessToken: string,
  properties: HubspotContactProperties
): Promise<string> {
  const res = await hubspotFetch(accessToken, `/crm/v3/objects/contacts`, {
    method: "POST",
    body: JSON.stringify({ properties: sanitizeProps(properties) }),
  });
  if (!res.ok) {
    throw new Error(`HubSpot create contact failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function updateContact(
  accessToken: string,
  contactId: string,
  properties: HubspotContactProperties
): Promise<void> {
  const res = await hubspotFetch(
    accessToken,
    `/crm/v3/objects/contacts/${contactId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ properties: sanitizeProps(properties) }),
    }
  );
  if (!res.ok) {
    throw new Error(`HubSpot update contact failed: ${await res.text()}`);
  }
}

export async function createDeal(
  accessToken: string,
  properties: HubspotDealProperties,
  contactId?: string
): Promise<string> {
  const associations = contactId
    ? [
        {
          to: { id: contactId },
          types: [
            {
              associationCategory: "HUBSPOT_DEFINED",
              associationTypeId: 3,
            },
          ],
        },
      ]
    : undefined;

  const res = await hubspotFetch(accessToken, `/crm/v3/objects/deals`, {
    method: "POST",
    body: JSON.stringify({
      properties: sanitizeProps(properties),
      associations,
    }),
  });

  if (!res.ok) {
    throw new Error(`HubSpot create deal failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function updateDeal(
  accessToken: string,
  dealId: string,
  properties: HubspotDealProperties
): Promise<void> {
  const res = await hubspotFetch(
    accessToken,
    `/crm/v3/objects/deals/${dealId}`,
    {
      method: "PATCH",
      body: JSON.stringify({ properties: sanitizeProps(properties) }),
    }
  );
  if (!res.ok) {
    throw new Error(`HubSpot update deal failed: ${await res.text()}`);
  }
}

export async function associateDealToContact(
  accessToken: string,
  dealId: string,
  contactId: string
): Promise<void> {
  const res = await hubspotFetch(
    accessToken,
    `/crm/v3/objects/deals/${dealId}/associations/contacts/${contactId}/3`,
    { method: "PUT" }
  );
  if (!res.ok) {
    throw new Error(
      `HubSpot associate deal->contact failed: ${await res.text()}`
    );
  }
}

export async function searchContactByMindbodyId(
  accessToken: string,
  mindbodyClientId: string
): Promise<string | null> {
  const res = await hubspotFetch(accessToken, `/crm/v3/objects/contacts/search`, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            {
              propertyName: "mindbody_client_id",
              operator: "EQ",
              value: mindbodyClientId,
            },
          ],
        },
      ],
      properties: ["email"],
      limit: 1,
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as { results: { id: string }[] };
  return data.results[0]?.id ?? null;
}

export async function searchDealByMindbodyId(
  accessToken: string,
  propertyName:
    | "mindbody_contract_id"
    | "mindbody_sale_id"
    | "mindbody_appointment_id"
    | "mindbody_visit_id",
  value: string
): Promise<string | null> {
  const res = await hubspotFetch(accessToken, `/crm/v3/objects/deals/search`, {
    method: "POST",
    body: JSON.stringify({
      filterGroups: [
        {
          filters: [
            {
              propertyName,
              operator: "EQ",
              value,
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
      `[hubspot] deal search failed for ${propertyName}=${value}: ${res.status} ${body}`
    );
    return null;
  }
  const data = (await res.json()) as { results: { id: string }[] };
  return data.results[0]?.id ?? null;
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
