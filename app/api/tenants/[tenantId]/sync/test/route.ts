import { NextRequest, NextResponse } from "next/server";
import { runInBackground } from "@/lib/background";
import { getSession } from "@/lib/auth/session";
import { dispatchTestSync } from "@/lib/queue/dispatch";
import { TEST_SYNC_RECORD_LIMIT } from "@/lib/sync/test-sync";
import type { EntityType } from "@/lib/db/types";

/** Deal test sync can exceed 60s (sales + line items + appointments). */
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  try {
    const { tenantId } = await params;
    const session = await getSession();
    if (!session || session.tenantId !== tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { entityType?: EntityType };
    const entityType = body.entityType ?? "contact";

    runInBackground(dispatchTestSync(tenantId, entityType));

    return NextResponse.json({
      ok: true,
      message: `Test sync started for ${entityType} (max ${TEST_SYNC_RECORD_LIMIT} records). Check Reports for progress.`,
    });
  } catch (e) {
    console.error("[test-sync] route error:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Test sync failed to start",
      },
      { status: 500 }
    );
  }
}
