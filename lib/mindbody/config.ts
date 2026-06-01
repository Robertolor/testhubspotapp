export const MINDBODY_PUBLIC_API = "https://api.mindbodyonline.com/public/v6";
export const MINDBODY_WEBHOOKS_API =
  "https://mb-api.mindbodyonline.com/push/api/v1";

export const MINDBODY_WEBHOOK_EVENTS = [
  "client.created",
  "client.updated",
  "clientContract.created",
  "clientContract.updated",
  "clientSale.created",
] as const;

export function getMindbodyDeveloperApiKey(): string {
  const key = process.env.MINDBODY_DEVELOPER_API_KEY;
  if (!key) {
    throw new Error("MINDBODY_DEVELOPER_API_KEY is not configured");
  }
  return key;
}
