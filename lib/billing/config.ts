const DEFAULT_TRIAL_DAYS = 14;

/** When false (default), every tenant is entitled. Set to "true" to require a Stripe trial/subscription. */
export function isBillingEnforcementEnabled(): boolean {
  return process.env.BILLING_ENFORCEMENT?.trim().toLowerCase() === "true";
}

/** Passed to Stripe Checkout as subscription_data.trial_period_days. Card is required up front. */
export function getBillingTrialDays(): number {
  const raw = process.env.BILLING_TRIAL_DAYS?.trim();
  if (!raw) return DEFAULT_TRIAL_DAYS;
  const days = Number.parseInt(raw, 10);
  if (!Number.isFinite(days) || days < 1) return DEFAULT_TRIAL_DAYS;
  return days;
}

export function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return key;
}

export function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return secret;
}

export type BillingInterval = "monthly" | "yearly";

export function getStripePriceId(interval: BillingInterval = "monthly"): string {
  if (interval === "yearly") {
    const yearly = process.env.STRIPE_PRICE_ID_YEARLY?.trim();
    if (!yearly) {
      throw new Error("STRIPE_PRICE_ID_YEARLY is not configured");
    }
    return yearly;
  }
  const monthly = process.env.STRIPE_PRICE_ID_MONTHLY?.trim();
  if (!monthly) throw new Error("STRIPE_PRICE_ID_MONTHLY is not configured");
  return monthly;
}

export function hasYearlyPrice(): boolean {
  return Boolean(process.env.STRIPE_PRICE_ID_YEARLY?.trim());
}

export function isStripeAutomaticTaxEnabled(): boolean {
  return process.env.STRIPE_AUTOMATIC_TAX?.trim().toLowerCase() === "true";
}
