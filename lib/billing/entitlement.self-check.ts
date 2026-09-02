import { getBillingTrialDays } from "./config";
import { evaluateEntitlement, isStripeStatusEntitled } from "./entitlement";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const off = evaluateEntitlement({
  subscriptionStatus: null,
  enforcement: false,
});
assert(off.entitled && off.reason === "enforcement_off", "kill switch must entitle");

const noCard = evaluateEntitlement({
  subscriptionStatus: null,
  enforcement: true,
});
assert(
  !noCard.entitled && noCard.reason === "no_subscription",
  "install without Stripe Checkout must not entitle"
);

const trialing = evaluateEntitlement({
  subscriptionStatus: "trialing",
  enforcement: true,
});
assert(trialing.entitled && trialing.reason === "trial", "card-on-file trial must entitle");

const paid = evaluateEntitlement({
  subscriptionStatus: "active",
  enforcement: true,
});
assert(paid.entitled && paid.reason === "subscription_active", "active sub must entitle");

const pastDue = evaluateEntitlement({
  subscriptionStatus: "past_due",
  enforcement: true,
});
assert(
  pastDue.entitled && pastDue.reason === "subscription_past_due",
  "past_due must stay entitled during dunning"
);

const canceled = evaluateEntitlement({
  subscriptionStatus: "canceled",
  enforcement: true,
});
assert(
  !canceled.entitled && canceled.reason === "subscription_inactive",
  "canceled trial or paid sub must lock"
);

const incomplete = evaluateEntitlement({
  subscriptionStatus: "incomplete",
  enforcement: true,
});
assert(!incomplete.entitled, "incomplete checkout must not entitle");

assert(isStripeStatusEntitled("trialing"), "trialing is entitled");
assert(isStripeStatusEntitled("ACTIVE"), "status match is case-insensitive");
assert(!isStripeStatusEntitled("canceled"), "canceled is not entitled");
assert(!isStripeStatusEntitled(null), "missing status is not entitled");

const savedDays = process.env.BILLING_TRIAL_DAYS;
try {
  delete process.env.BILLING_TRIAL_DAYS;
  assert(getBillingTrialDays() === 14, "default trial days");
  process.env.BILLING_TRIAL_DAYS = "21";
  assert(getBillingTrialDays() === 21, "env trial days");
  process.env.BILLING_TRIAL_DAYS = "0";
  assert(getBillingTrialDays() === 14, "invalid trial days fall back");
} finally {
  if (savedDays === undefined) delete process.env.BILLING_TRIAL_DAYS;
  else process.env.BILLING_TRIAL_DAYS = savedDays;
}

console.log("billing entitlement self-check passed");
