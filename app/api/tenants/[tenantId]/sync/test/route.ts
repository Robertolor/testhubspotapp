import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dispatchTestSync } from "@/lib/inngest/dispatch";
import { TEST_SYNC_RECORD_LIMIT } from "@/lib/sync/test-sync";
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

  await dispatchTestSync(tenantId, entityType);

  return NextResponse.json({
    ok: true,
    message: `Test sync started for ${entityType} (max ${TEST_SYNC_RECORD_LIMIT} records). Check Reports for details.`,
  });
}
