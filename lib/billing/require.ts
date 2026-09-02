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
        error: "Billing is not set up yet. Start a trial to sync.",
        reason: entitlement.reason,
        billingPath: "/billing",
      },
      { status: 402 }
    );
  }
  return null;
}
