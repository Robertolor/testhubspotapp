import { getAppUrl } from "@/lib/utils";

export const HUBSPOT_SCOPES = [
  "oauth",
  "crm.objects.contacts.read",
  "crm.objects.contacts.write",
  "crm.objects.deals.read",
  "crm.objects.deals.write",
  "crm.objects.line_items.read",
  "crm.objects.line_items.write",
  "crm.schemas.contacts.read",
  "crm.schemas.contacts.write",
  "crm.schemas.deals.read",
  "crm.schemas.deals.write",
  // HubSpot has no crm.schemas.line_items.write — only read is valid
  "crm.schemas.line_items.read",
].join(" ");

export const HUBSPOT_WEBHOOK_EVENTS = [
  "contact.creation",
  "contact.propertyChange",
  "contact.deletion",
  "deal.creation",
  "deal.propertyChange",
  "deal.deletion",
] as const;

export function getHubspotRedirectUri(): string {
  return (
    process.env.HUBSPOT_REDIRECT_URI ||
    `${getAppUrl()}/api/oauth/hubspot/callback`
  );
}

export function getHubspotClientId(): string {
  const id = process.env.HUBSPOT_CLIENT_ID;
  if (!id) throw new Error("HUBSPOT_CLIENT_ID is not configured");
  return id;
}

export function getHubspotClientSecret(): string {
  const secret = process.env.HUBSPOT_CLIENT_SECRET;
  if (!secret) throw new Error("HUBSPOT_CLIENT_SECRET is not configured");
  return secret;
}

export function getHubspotAppId(): string {
  const id = process.env.HUBSPOT_APP_ID;
  if (!id) throw new Error("HUBSPOT_APP_ID is not configured");
  return id;
}
