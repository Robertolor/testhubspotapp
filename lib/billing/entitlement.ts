import { getSupabase } from "@/lib/db/client";
import { isBillingEnforcementEnabled } from "./config";

/** Stripe statuses that still allow sync (dunning grace included). */
const ENTITLED_STRIPE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
]);

export type BillingEntitlementReason =
  | "enforcement_off"
  | "trial"
  | "subscription_active"
  | "subscription_past_due"
  | "subscription_inactive"
  | "no_subscription";

export interface EntitlementInput {
  subscriptionStatus: string | null;
  enforcement: boolean;
}

export interface EntitlementResult {
  entitled: boolean;
  reason: BillingEntitlementReason;
}

export interface TenantBillingSnapshot {
  tenantId: string;
  tenantStatus: string;
  trialEndsAt: string | null;
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
}

/**
 * Access follows Stripe only. A HubSpot install without a Checkout subscription
 * is not entitled when enforcement is on. Card-required trials use status "trialing";
 * Stripe charges the saved card when the trial ends.
 */
export function evaluateEntitlement(input: EntitlementInput): EntitlementResult {
  if (!input.enforcement) {
    return { entitled: true, reason: "enforcement_off" };
  }

  const status = input.subscriptionStatus?.trim().toLowerCase() || null;
  if (status === "trialing") {
    return { entitled: true, reason: "trial" };
  }
  if (status === "past_due") {
    return { entitled: true, reason: "subscription_past_due" };
  }
  if (status === "active") {
    return { entitled: true, reason: "subscription_active" };
  }
  if (status) {
    return { entitled: false, reason: "subscription_inactive" };
  }
  return { entitled: false, reason: "no_subscription" };
}

export function isStripeStatusEntitled(status: string | null | undefined): boolean {
  if (!status) return false;
  return ENTITLED_STRIPE_STATUSES.has(status.trim().toLowerCase());
}

export async function loadTenantBillingSnapshot(
  tenantId: string
): Promise<TenantBillingSnapshot | null> {
  const { data: tenant, error: tenantError } = await getSupabase()
    .from("tenants")
    .select("id, status, trial_ends_at")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError) throw tenantError;
  if (!tenant) return null;

  const { data: sub, error: subError } = await getSupabase()
    .from("billing_subscriptions")
    .select("status, cancel_at_period_end, current_period_end")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (subError) throw subError;

  return {
    tenantId: tenant.id as string,
    tenantStatus: tenant.status as string,
    trialEndsAt: (tenant.trial_ends_at as string | null) ?? null,
    subscriptionStatus: (sub?.status as string | null) ?? null,
    cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
    currentPeriodEnd: (sub?.current_period_end as string | null) ?? null,
  };
}

export async function getTenantEntitlement(
  tenantId: string
): Promise<(EntitlementResult & { snapshot: TenantBillingSnapshot }) | null> {
  const snapshot = await loadTenantBillingSnapshot(tenantId);
  if (!snapshot) return null;
  return {
    ...evaluateEntitlement({
      subscriptionStatus: snapshot.subscriptionStatus,
      enforcement: isBillingEnforcementEnabled(),
    }),
    snapshot,
  };
}
