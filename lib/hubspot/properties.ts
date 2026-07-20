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
    name: "mindbody_appointment_id",
    label: "Mindbody Appointment ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "mindbody_visit_id",
    label: "Mindbody Visit ID",
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
      { label: "Appointment", value: "mindbody_appointment" },
      { label: "Visit", value: "mindbody_visit" },
    ],
  },
] as const;

const BOOL_PROPERTY_OPTIONS = [
  { label: "Yes", value: "true", displayOrder: 0, hidden: false },
  { label: "No", value: "false", displayOrder: 1, hidden: false },
] as const;

const LINE_ITEM_PROPERTIES = [
  {
    name: "mindbody_line_item_key",
    label: "Mindbody Line Item Key",
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
    name: "mindbody_sale_detail_id",
    label: "Mindbody Sale Detail ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "mindbody_item_id",
    label: "Mindbody Item ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "mindbody_contract_id",
    label: "Mindbody Contract ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "mindbody_recipient_client_id",
    label: "Recipient Client ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "mindbody_is_service",
    label: "Is Service",
    type: "bool",
    fieldType: "booleancheckbox",
    groupName: "mindbody_sync",
    options: [...BOOL_PROPERTY_OPTIONS],
  },
  {
    name: "mindbody_category_id",
    label: "Mindbody Category ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "mindbody_subcategory_id",
    label: "Mindbody Subcategory ID",
    type: "string",
    fieldType: "text",
    groupName: "mindbody_sync",
  },
  {
    name: "mindbody_returned",
    label: "Returned",
    type: "bool",
    fieldType: "booleancheckbox",
    groupName: "mindbody_sync",
    options: [...BOOL_PROPERTY_OPTIONS],
  },
] as const;

type HubspotPropertyObject = "contacts" | "deals" | "line_items";

async function ensurePropertyGroup(
  accessToken: string,
  objectType: HubspotPropertyObject
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
    if (text.includes("already exists")) return;
    throw new Error(`Failed to create HubSpot property group for ${objectType}: ${text}`);
  }
}

async function ensureProperty(
  accessToken: string,
  objectType: HubspotPropertyObject,
  prop:
    | (typeof CONTACT_PROPERTIES)[number]
    | (typeof DEAL_PROPERTIES)[number]
    | (typeof LINE_ITEM_PROPERTIES)[number]
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
    if (text.includes("already exists")) return;
    // Soft-fail: one bad custom property must not abort the whole sync run.
    console.warn(
      `[hubspot] Failed to create property ${objectType}.${prop.name}: ${text}`
    );
  }
}

export async function bootstrapHubspotProperties(
  accessToken: string
): Promise<void> {
  await ensurePropertyGroup(accessToken, "contacts");
  await ensurePropertyGroup(accessToken, "deals");
  await ensurePropertyGroup(accessToken, "line_items");

  for (const prop of CONTACT_PROPERTIES) {
    await ensureProperty(accessToken, "contacts", prop);
  }
  for (const prop of DEAL_PROPERTIES) {
    await ensureProperty(accessToken, "deals", prop);
  }
  for (const prop of LINE_ITEM_PROPERTIES) {
    await ensureProperty(accessToken, "line_items", prop);
  }

  await ensureDealSourceOptions(accessToken);
}

async function ensureDealSourceOptions(accessToken: string): Promise<void> {
  const desired = [
    { label: "Contract", value: "mindbody_contract" },
    { label: "Sale", value: "mindbody_sale" },
    { label: "Appointment", value: "mindbody_appointment" },
    { label: "Visit", value: "mindbody_visit" },
  ];

  const getRes = await fetch(
    "https://api.hubapi.com/crm/v3/properties/deals/deal_source",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!getRes.ok) return;

  const existing = (await getRes.json()) as {
    options?: { label: string; value: string }[];
  };
  const current = existing.options ?? [];
  const values = new Set(current.map((o) => o.value));
  const merged = [...current];
  for (const option of desired) {
    if (!values.has(option.value)) merged.push(option);
  }
  if (merged.length === current.length) return;

  const patchRes = await fetch(
    "https://api.hubapi.com/crm/v3/properties/deals/deal_source",
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ options: merged }),
    }
  );
  if (!patchRes.ok) {
    console.warn(
      "[hubspot] Failed to update deal_source options:",
      await patchRes.text()
    );
  }
}
