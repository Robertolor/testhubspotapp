const CONTACT_PROPERTIES = [
  {
    name: "mindbody_client_id",
    label: "Mindbody Client ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "mindbody_site_id",
    label: "Mindbody Site ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "mindbody_last_synced_at",
    label: "Mindbody Last Synced At",
    type: "datetime",
    fieldType: "date",
    groupName: "mindbody_sync",
  },
] as const;

const DEAL_PROPERTIES = [
  {
    name: "mindbody_contract_id",
    label: "Mindbody Contract ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "mindbody_sale_id",
    label: "Mindbody Sale ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "mindbody_client_id",
    label: "Mindbody Client ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "deal_source",
    label: "Mindbody Deal Source",
    type: "enumeration",
    fieldType: "select",
    groupName: "mindbody_sync",
    options: [
      { label: "Contract", value: "mindbody_contract" },
      { label: "Sale", value: "mindbody_sale" },
    ],
  },
] as const;

async function ensurePropertyGroup(
  accessToken: string,
  objectType: "contacts" | "deals"
): Promise<void> {
  const res = await fetch(
    `https://api.hubapi.com/crm/v3/properties/${objectType}/groups`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "mindbody_sync",
        label: "Mindbody Sync",
        displayOrder: -1,
      }),
    }
  );
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    if (!text.includes("already exists")) {
      console.warn(`Property group ${objectType}: ${text}`);
    }
  }
}

async function ensureProperty(
  accessToken: string,
  objectType: "contacts" | "deals",
  prop: (typeof CONTACT_PROPERTIES)[number] | (typeof DEAL_PROPERTIES)[number]
): Promise<void> {
  const res = await fetch(
    `https://api.hubapi.com/crm/v3/properties/${objectType}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(prop),
    }
  );
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    if (!text.includes("already exists")) {
      console.warn(`Property ${prop.name}: ${text}`);
    }
  }
}

export async function bootstrapHubspotProperties(
  accessToken: string
): Promise<void> {
  await ensurePropertyGroup(accessToken, "contacts");
  await ensurePropertyGroup(accessToken, "deals");

  for (const prop of CONTACT_PROPERTIES) {
    await ensureProperty(accessToken, "contacts", prop);
  }
  for (const prop of DEAL_PROPERTIES) {
    await ensureProperty(accessToken, "deals", prop);
  }
}
