import { NextResponse } from "next/server";
import { getTenantEntitlement } from "./entitlement";

export async function requireBillingEntitlement(
  tenantId: string
): Promise<NextResponse | null> {
  const entitlement = await getTenantEntitlement(tenantId);
  if (!entitlement) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }
  if (!entitlement.entitled) {
    return NextResponse.json(
      {
        error:
          "A Stripe trial or subscription is required to sync. Open Billing to start a 14-day trial (card required).",
        reason: entitlement.reason,
        billingPath: "/billing",
      },
      { status: 402 }
    );
  }
  return null;
}
