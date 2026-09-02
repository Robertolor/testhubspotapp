import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getSession } from "@/lib/auth/session";
import { getStripe } from "@/lib/billing/stripe";
import { getBillingSubscriptionRow } from "@/lib/billing/subscription";
import { getAppUrl } from "@/lib/utils";

type PortalFlow = "default" | "cancel" | "payment_method";

function parseFlow(value: unknown): PortalFlow {
  if (value === "cancel" || value === "payment_method") return value;
  return "default";
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getBillingSubscriptionRow(session.tenantId);
  if (!existing?.stripe_customer_id) {
    return NextResponse.json(
      { error: "Start a trial first. There is no Stripe customer yet." },
      { status: 400 }
    );
  }

  let flow: PortalFlow = "default";
  try {
    const body = (await request.json()) as { flow?: unknown };
    flow = parseFlow(body.flow);
  } catch {
    flow = "default";
  }

  const stripe = getStripe();
  const returnUrl = `${getAppUrl()}/billing`;
  const params: Stripe.BillingPortal.SessionCreateParams = {
    customer: existing.stripe_customer_id,
    return_url: returnUrl,
  };

  if (flow === "cancel" && existing.stripe_subscription_id) {
    params.flow_data = {
      type: "subscription_cancel",
      subscription_cancel: {
        subscription: existing.stripe_subscription_id,
      },
    };
  } else if (flow === "payment_method") {
    params.flow_data = {
      type: "payment_method_update",
    };
  }

  try {
    const portal = await stripe.billingPortal.sessions.create(params);
    return NextResponse.json({ url: portal.url });
  } catch (error) {
    console.error("Stripe billing portal session failed:", error);
    if (params.flow_data) {
      const fallback = await stripe.billingPortal.sessions.create({
        customer: existing.stripe_customer_id,
        return_url: returnUrl,
      });
      return NextResponse.json({ url: fallback.url });
    }
    return NextResponse.json(
      { error: "Could not open billing." },
      { status: 500 }
    );
  }
}
