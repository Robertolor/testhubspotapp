import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dispatchBackfill } from "@/lib/inngest/dispatch";
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

  const body = (await request.json()) as { entityType?: EntityType };
  const entityType = body.entityType ?? "contact";

  await dispatchBackfill(tenantId, entityType);

  return NextResponse.json({
    ok: true,
    message: `Backfill for ${entityType} queued`,
  });
}
