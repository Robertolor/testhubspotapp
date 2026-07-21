import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/client";
import { reconcileStaleSyncRuns } from "@/lib/sync/runs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const session = await getSession();
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await reconcileStaleSyncRuns(tenantId);

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? "20");
  const status = request.nextUrl.searchParams.get("status");

  let query = getSupabase()
    .from("sync_runs")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("started_at", { ascending: false })
    .limit(Math.min(limit, 100));

  if (status) {
    query = query.eq("status", status);
  }

  const { data: runs, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: errors } = await getSupabase()
    .from("sync_errors")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(50);

  return NextResponse.json({ runs: runs ?? [], errors: errors ?? [] });
}
