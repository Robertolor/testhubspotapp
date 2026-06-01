import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/client";

export async function GET(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ tenantId: string; runId: string }> }
) {
  const { tenantId, runId } = await params;
  const session = await getSession();
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: run, error: runError } = await getSupabase()
    .from("sync_runs")
    .select("*")
    .eq("id", runId)
    .eq("tenant_id", tenantId)
    .single();

  if (runError || !run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: events } = await getSupabase()
    .from("sync_events")
    .select("*")
    .eq("sync_run_id", runId)
    .order("created_at", { ascending: true });

  return NextResponse.json({ run, events: events ?? [] });
}
