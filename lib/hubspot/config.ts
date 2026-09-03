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

/** CRM webhook subscriptions. HubSpot has no app.uninstall event type. */
export const HUBSPOT_WEBHOOK_SUBSCRIPTIONS: Array<{
  eventType: string;
  propertyName?: string;
}> = [
  { eventType: "contact.creation" },
  { eventType: "contact.deletion" },
  { eventType: "contact.privacyDeletion" },
  { eventType: "contact.propertyChange", propertyName: "email" },
  { eventType: "contact.propertyChange", propertyName: "firstname" },
  { eventType: "contact.propertyChange", propertyName: "lastname" },
  { eventType: "contact.propertyChange", propertyName: "phone" },
  { eventType: "contact.propertyChange", propertyName: "mindbody_client_id" },
  { eventType: "deal.creation" },
  { eventType: "deal.deletion" },
  { eventType: "deal.propertyChange", propertyName: "dealname" },
  { eventType: "deal.propertyChange", propertyName: "amount" },
  { eventType: "deal.propertyChange", propertyName: "closedate" },
  { eventType: "deal.propertyChange", propertyName: "dealstage" },
  { eventType: "deal.propertyChange", propertyName: "deal_source" },
  { eventType: "line_item.creation" },
  { eventType: "line_item.deletion" },
];

/** @deprecated Use HUBSPOT_WEBHOOK_SUBSCRIPTIONS. Kept for event-type checks. */
export const HUBSPOT_WEBHOOK_EVENTS = HUBSPOT_WEBHOOK_SUBSCRIPTIONS.map(
  (item) => item.eventType
);

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
