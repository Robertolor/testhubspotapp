import { getHubspotAccountByPortal } from "@/lib/hubspot/tokens";
import { getStripe } from "./stripe";
import { getBillingSubscriptionRow } from "./subscription";

export function isHubspotUninstallEvent(event: Record<string, unknown>): boolean {
  const type = String(
    event.subscriptionType ?? event.eventType ?? event.type ?? ""
  ).toLowerCase();
  return type.includes("uninstall");
}

export async function cancelStripeForPortal(
  portalId: number
): Promise<{ canceled: boolean }> {
  const account = await getHubspotAccountByPortal(portalId);
  if (!account) return { canceled: false };

  const row = await getBillingSubscriptionRow(account.tenant_id);
  if (!row?.stripe_subscription_id) return { canceled: false };
  if (row.status === "canceled") return { canceled: false };

  try {
    await getStripe().subscriptions.cancel(row.stripe_subscription_id);
    return { canceled: true };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      message.includes("no such subscription") ||
      message.includes("canceled")
    ) {
      return { canceled: false };
    }
    throw error;
  }
}
