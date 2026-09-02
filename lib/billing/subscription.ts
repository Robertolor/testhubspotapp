import type Stripe from "stripe";
import { getSupabase } from "@/lib/db/client";

function unixToIso(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription): string | null {
  const itemEnd = subscription.items?.data?.[0]?.current_period_end;
  const rootEnd = (subscription as { current_period_end?: number }).current_period_end;
  return unixToIso(itemEnd ?? rootEnd ?? null);
}

export async function upsertBillingFromSubscription(input: {
  tenantId: string;
  subscription: Stripe.Subscription;
  billingEmail?: string | null;
}): Promise<void> {
  const { tenantId, subscription, billingEmail } = input;
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  const priceId = subscription.items.data[0]?.price?.id ?? null;
  const trialEnd = unixToIso(subscription.trial_end);
  const now = new Date().toISOString();

  const row: Record<string, unknown> = {
    tenant_id: tenantId,
    stripe_customer_id: customerId ?? null,
    stripe_subscription_id: subscription.id,
    stripe_price_id: priceId,
    status: subscription.status,
    current_period_end: subscriptionPeriodEnd(subscription),
    cancel_at_period_end: Boolean(subscription.cancel_at_period_end),
    updated_at: now,
  };
  if (billingEmail) {
    row.billing_email = billingEmail;
  }

  const { error } = await getSupabase().from("billing_subscriptions").upsert(
    row,
    { onConflict: "tenant_id" }
  );

  if (error) throw error;

  if (trialEnd) {
    await getSupabase()
      .from("tenants")
      .update({ trial_ends_at: trialEnd, updated_at: now })
      .eq("id", tenantId);
  }
}

export async function getBillingSubscriptionRow(tenantId: string): Promise<{
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_email: string | null;
} | null> {
  const { data, error } = await getSupabase()
    .from("billing_subscriptions")
    .select(
      "stripe_customer_id, stripe_subscription_id, stripe_price_id, status, current_period_end, cancel_at_period_end, billing_email"
    )
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function findTenantIdForStripeSubscription(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const fromMeta = subscription.metadata?.tenant_id?.trim();
  if (fromMeta) return fromMeta;

  const { data, error } = await getSupabase()
    .from("billing_subscriptions")
    .select("tenant_id")
    .eq("stripe_subscription_id", subscription.id)
    .maybeSingle();

  if (error) throw error;
  if (data?.tenant_id) return data.tenant_id as string;

  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id;
  if (!customerId) return null;

  const { data: byCustomer, error: customerError } = await getSupabase()
    .from("billing_subscriptions")
    .select("tenant_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (customerError) throw customerError;
  return (byCustomer?.tenant_id as string | undefined) ?? null;
}
