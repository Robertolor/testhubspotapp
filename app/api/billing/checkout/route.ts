import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isStripeStatusEntitled } from "@/lib/billing/entitlement";
import {
  getBillingTrialDays,
  getStripePriceId,
  type BillingInterval,
} from "@/lib/billing/config";
import {
  buildCheckoutSessionCreateParams,
  shouldIncludeCheckoutTrial,
} from "@/lib/billing/checkout";
import { getStripe } from "@/lib/billing/stripe";
import { getBillingSubscriptionRow } from "@/lib/billing/subscription";
import { getAppUrl } from "@/lib/utils";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let interval: BillingInterval = "monthly";
  try {
    const body = (await request.json()) as { interval?: string };
    if (body.interval === "yearly") interval = "yearly";
  } catch {
    interval = "monthly";
  }

  const existing = await getBillingSubscriptionRow(session.tenantId);
  if (isStripeStatusEntitled(existing?.status)) {
    return NextResponse.json(
      { error: "An active trial or subscription already exists.", billingPath: "/billing" },
      { status: 409 }
    );
  }

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.create(
    buildCheckoutSessionCreateParams({
      tenantId: session.tenantId,
      portalId: session.portalId,
      priceId: getStripePriceId(interval),
      trialDays: getBillingTrialDays(),
      includeTrial: shouldIncludeCheckoutTrial(existing?.status ?? null),
      customerId: existing?.stripe_customer_id,
      successUrl: `${getAppUrl()}/billing?checkout=success`,
      cancelUrl: `${getAppUrl()}/billing?checkout=canceled`,
    })
  );

  if (!checkout.url) {
    return NextResponse.json(
      { error: "Stripe did not return a checkout URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: checkout.url });
}
