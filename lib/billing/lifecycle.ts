import type Stripe from "stripe";
import { getStripe } from "./stripe";
import {
  getBillingSubscriptionRow,
  upsertBillingFromSubscription,
} from "./subscription";
import { isStripeStatusEntitled } from "./entitlement";

export async function setCancelAtPeriodEnd(input: {
  tenantId: string;
  cancel: boolean;
}): Promise<Stripe.Subscription | null> {
  const row = await getBillingSubscriptionRow(input.tenantId);
  if (!row?.stripe_subscription_id) return null;
  if (row.status === "canceled") return null;

  const subscription = await getStripe().subscriptions.update(
    row.stripe_subscription_id,
    { cancel_at_period_end: input.cancel }
  );
  await upsertBillingFromSubscription({
    tenantId: input.tenantId,
    subscription,
  });
  return subscription;
}

/** HubSpot uninstall: stop new charges at period/trial end, keep the paid window. */
export async function scheduleStripeCancelForTenant(
  tenantId: string
): Promise<{ scheduled: boolean }> {
  const row = await getBillingSubscriptionRow(tenantId);
  if (!row?.stripe_subscription_id) return { scheduled: false };
  if (row.status === "canceled") return { scheduled: false };
  if (row.cancel_at_period_end) return { scheduled: true };

  await setCancelAtPeriodEnd({ tenantId, cancel: true });
  return { scheduled: true };
}

/** Reinstall or in-app undo: keep the current trial or paid period. */
export async function resumeStripeIfScheduled(
  tenantId: string
): Promise<{ resumed: boolean }> {
  const row = await getBillingSubscriptionRow(tenantId);
  if (!row?.stripe_subscription_id) return { resumed: false };
  if (!row.cancel_at_period_end) return { resumed: false };
  if (!isStripeStatusEntitled(row.status)) return { resumed: false };

  await setCancelAtPeriodEnd({ tenantId, cancel: false });
  return { resumed: true };
}
