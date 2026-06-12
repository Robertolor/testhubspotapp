import { after, NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { dispatchTestSync } from "@/lib/inngest/dispatch";
import { TEST_SYNC_RECORD_LIMIT } from "@/lib/sync/test-sync";
import type { EntityType } from "@/lib/db/types";

/** TEMP: test sync may run up to 20 Mindbody → HubSpot operations */
export const maxDuration = 60;

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

    after(async () => {
      try {
        await dispatchTestSync(tenantId, entityType);
      } catch (e) {
        console.error("[test-sync] background run failed:", e);
      }
    });

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
