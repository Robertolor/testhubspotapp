import { getHubspotAccountByPortal } from "@/lib/hubspot/tokens";
import { getStripe } from "./stripe";
import {
  getBillingSubscriptionRow,
  upsertBillingFromSubscription,
} from "./subscription";
import { scheduleStripeCancelForTenant } from "./lifecycle";

export function isHubspotUninstallEvent(event: Record<string, unknown>): boolean {
  const type = String(
    event.subscriptionType ?? event.eventType ?? event.type ?? ""
  ).toLowerCase();
  return type.includes("uninstall");
}

async function persistSubscriptionStatus(
  tenantId: string,
  subscriptionId: string
): Promise<void> {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await upsertBillingFromSubscription({ tenantId, subscription });
}

/**
 * HubSpot uninstall: do not cancel Stripe today. Schedule cancel at period or
 * trial end so an accidental reinstall can keep the paid window.
 */
export async function cancelStripeForPortal(
  portalId: number
): Promise<{ canceled: boolean }> {
  const account = await getHubspotAccountByPortal(portalId);
  if (!account) return { canceled: false };

  const row = await getBillingSubscriptionRow(account.tenant_id);
  if (!row?.stripe_subscription_id) return { canceled: false };
  if (row.status === "canceled") return { canceled: false };

  try {
    const result = await scheduleStripeCancelForTenant(account.tenant_id);
    return { canceled: result.scheduled };
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (
      message.includes("no such subscription") ||
      message.includes("canceled")
    ) {
      try {
        await persistSubscriptionStatus(
          account.tenant_id,
          row.stripe_subscription_id
        );
      } catch {
        // Stripe already gone; local row may still update from a later webhook.
      }
      return { canceled: false };
    }
    throw error;
  }
}
