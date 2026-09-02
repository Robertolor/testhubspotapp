import type Stripe from "stripe";
import { isStripeAutomaticTaxEnabled } from "./config";

export function shouldIncludeCheckoutTrial(status: string | null): boolean {
  if (!status) return true;
  const normalized = status.trim().toLowerCase();
  return normalized === "incomplete" || normalized === "incomplete_expired";
}

export function buildCheckoutSessionCreateParams(input: {
  tenantId: string;
  portalId: number;
  priceId: string;
  trialDays: number;
  includeTrial: boolean;
  customerId?: string | null;
  successUrl: string;
  cancelUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  const metadata = {
    tenant_id: input.tenantId,
    portal_id: String(input.portalId),
  };

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    client_reference_id: input.tenantId,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true,
    payment_method_collection: "always",
    line_items: [{ price: input.priceId, quantity: 1 }],
    metadata,
    subscription_data: {
      metadata,
      ...(input.includeTrial ? { trial_period_days: input.trialDays } : {}),
    },
  };

  if (input.customerId) {
    params.customer = input.customerId;
  }

  if (isStripeAutomaticTaxEnabled()) {
    params.automatic_tax = { enabled: true };
    params.tax_id_collection = { enabled: true };
  }

  return params;
}
