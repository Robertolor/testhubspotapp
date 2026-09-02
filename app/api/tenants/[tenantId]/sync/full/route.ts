import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { requireBillingEntitlement } from "@/lib/billing/require";
import { requireMindbodyConfigured } from "@/lib/mindbody/require";
import { dispatchBackfill } from "@/lib/queue/dispatch";
import type { EntityType } from "@/lib/db/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const session = await getSession();
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const denied = await requireBillingEntitlement(tenantId);
  if (denied) return denied;

  const mindbodyDenied = await requireMindbodyConfigured(tenantId);
  if (mindbodyDenied) return mindbodyDenied;

  const body = (await request.json()) as { entityType?: EntityType };
  const entityType = body.entityType ?? "contact";

  await dispatchBackfill(tenantId, entityType);

  return NextResponse.json({
    ok: true,
    message: `Started a full ${entityType} sync. Check Reports for progress.`,
  });
}
