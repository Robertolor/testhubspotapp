/**
 * Close stale running sync runs for the sandbox tenant.
 * Usage: npx tsx scripts/close-stale-sync-runs.ts
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

const TENANT_ID = "97a3b9c7-74c9-44ff-9201-eec8735e2154";

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  // Avoid supabase-js Realtime/WebSocket requirement on Node 20.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };

  const cutoff = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const staleRes = await fetch(
    `${url}/rest/v1/sync_runs?select=id,entity_type&tenant_id=eq.${TENANT_ID}&status=eq.running&started_at=lt.${cutoff}`,
    { headers }
  );
  const stale = (await staleRes.json()) as Array<{
    id: string;
    entity_type: string | null;
  }>;

  for (const run of stale) {
    const eventsRes = await fetch(
      `${url}/rest/v1/sync_events?select=status,message,source_id&sync_run_id=eq.${run.id}`,
      { headers }
    );
    const events = (await eventsRes.json()) as Array<{
      status: string;
      message: string | null;
      source_id: string | null;
    }>;

    const processed = events.filter(
      (e) =>
        e.status === "success" &&
        e.source_id &&
        (e.message === "created" || e.message === "updated")
    ).length;
    const failed = events.filter((e) => e.status === "failed").length;
    const status =
      failed > 0
        ? processed > 0
          ? "partial"
          : "failed"
        : processed > 0
          ? "completed"
          : "failed";

    const patchRes = await fetch(
      `${url}/rest/v1/sync_runs?id=eq.${run.id}&status=eq.running`,
      {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          status,
          records_processed: processed,
          records_failed: failed,
          completed_at: new Date().toISOString(),
        }),
      }
    );
    const patched = await patchRes.json();
    console.log("closed", run.id, { status, processed, failed, patched });
  }

  if (stale.length === 0) console.log("No stale running runs.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
