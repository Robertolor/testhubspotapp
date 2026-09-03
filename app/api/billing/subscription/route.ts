import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isStripeStatusEntitled } from "@/lib/billing/entitlement";
import { setCancelAtPeriodEnd } from "@/lib/billing/lifecycle";
import { getBillingSubscriptionRow } from "@/lib/billing/subscription";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let action: "cancel_at_period_end" | "resume" = "cancel_at_period_end";
  try {
    const body = (await request.json()) as { action?: string };
    if (body.action === "resume") action = "resume";
  } catch {
    action = "cancel_at_period_end";
  }

  const existing = await getBillingSubscriptionRow(session.tenantId);
  if (!existing?.stripe_subscription_id) {
    return NextResponse.json(
      { error: "There is no subscription to update." },
      { status: 400 }
    );
  }
  if (!isStripeStatusEntitled(existing.status)) {
    return NextResponse.json(
      { error: "This subscription is not active." },
      { status: 409 }
    );
  }

  const subscription = await setCancelAtPeriodEnd({
    tenantId: session.tenantId,
    cancel: action === "cancel_at_period_end",
  });
  if (!subscription) {
    return NextResponse.json(
      { error: "Could not update the subscription." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}
