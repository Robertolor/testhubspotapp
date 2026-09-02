import {
  buildCheckoutSessionCreateParams,
  shouldIncludeCheckoutTrial,
} from "./checkout";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

assert(shouldIncludeCheckoutTrial(null), "first checkout includes trial");
assert(shouldIncludeCheckoutTrial("incomplete"), "incomplete retry includes trial");
assert(
  !shouldIncludeCheckoutTrial("canceled"),
  "canceled customer does not get a second trial"
);
assert(
  !shouldIncludeCheckoutTrial("trialing"),
  "already trialing does not start another trial"
);

const withTrial = buildCheckoutSessionCreateParams({
  tenantId: "tenant-1",
  portalId: 123,
  priceId: "price_monthly",
  trialDays: 14,
  includeTrial: true,
  successUrl: "https://example.com/billing?checkout=success",
  cancelUrl: "https://example.com/billing?checkout=canceled",
});

assert(withTrial.mode === "subscription", "mode is subscription");
assert(withTrial.payment_method_collection === "always", "card required");
assert(withTrial.subscription_data?.trial_period_days === 14, "trial days set");
assert(withTrial.client_reference_id === "tenant-1", "tenant on session");
assert(
  withTrial.subscription_data?.metadata?.tenant_id === "tenant-1",
  "tenant on subscription metadata"
);
assert(!withTrial.customer, "no customer on first checkout");

const returning = buildCheckoutSessionCreateParams({
  tenantId: "tenant-1",
  portalId: 123,
  priceId: "price_monthly",
  trialDays: 14,
  includeTrial: false,
  customerId: "cus_123",
  successUrl: "https://example.com/ok",
  cancelUrl: "https://example.com/cancel",
});
assert(!returning.subscription_data?.trial_period_days, "no second trial");
assert(returning.customer === "cus_123", "reuse Stripe customer");

console.log("billing checkout self-check passed");
