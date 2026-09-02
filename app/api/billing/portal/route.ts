import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getStripe } from "@/lib/billing/stripe";
import { getBillingSubscriptionRow } from "@/lib/billing/subscription";
import { getAppUrl } from "@/lib/utils";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await getBillingSubscriptionRow(session.tenantId);
  if (!existing?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer yet. Start a trial first." },
      { status: 400 }
    );
  }

  const portal = await getStripe().billingPortal.sessions.create({
    customer: existing.stripe_customer_id,
    return_url: `${getAppUrl()}/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
