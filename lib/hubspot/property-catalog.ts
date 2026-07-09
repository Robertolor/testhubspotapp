const HS_BASE = "https://api.hubapi.com";

export type HubspotCatalogObject = "contacts" | "deals" | "line_items";

export interface HubspotPropertyCatalogItem {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  readOnly: boolean;
  groupName: string;
  options?: { label: string; value: string }[];
}

interface HubspotPropertyResponse {
  name: string;
  label: string;
  type: string;
  fieldType: string;
  groupName: string;
  modificationMetadata?: { readOnlyValue?: boolean };
  options?: { label: string; value: string }[];
}

function sortCatalogItems(
  items: HubspotPropertyCatalogItem[]
): HubspotPropertyCatalogItem[] {
  return [...items].sort((a, b) => {
    const aMindbody = a.groupName === "mindbody_sync" ? 0 : 1;
    const bMindbody = b.groupName === "mindbody_sync" ? 0 : 1;
    if (aMindbody !== bMindbody) return aMindbody - bMindbody;
    return a.label.localeCompare(b.label, undefined, { sensitivity: "base" });
  });
}

export function parseHubspotCatalogObject(
  value: string | null
): HubspotCatalogObject | null {
  if (value === "contacts" || value === "deals" || value === "line_items") {
    return value;
  }
  return null;
}

export async function listHubspotProperties(
  accessToken: string,
  object: HubspotCatalogObject
): Promise<HubspotPropertyCatalogItem[]> {
  const res = await fetch(`${HS_BASE}/crm/v3/properties/${object}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`HubSpot properties list failed: ${await res.text()}`);
  }

  const data = (await res.json()) as { results?: HubspotPropertyResponse[] };
  const items = (data.results ?? []).map((prop) => ({
    name: prop.name,
    label: prop.label,
    type: prop.type,
    fieldType: prop.fieldType,
    readOnly: Boolean(prop.modificationMetadata?.readOnlyValue),
    groupName: prop.groupName,
    ...(prop.options?.length
      ? {
          options: prop.options.map((o) => ({
            label: o.label,
            value: o.value,
          })),
        }
      : {}),
  }));

  return sortCatalogItems(items);
}
