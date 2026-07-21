/**
 * Inspect a stuck sync run. Usage:
 *   npx tsx scripts/inspect-sync-run.ts [runId?]
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

async function supabaseGet(table: string, query: string): Promise<unknown> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const res = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function main(): Promise<void> {
  loadEnvLocal();
  const runIdArg = process.argv[2];

  const runs = (await supabaseGet(
    "sync_runs",
    runIdArg
      ? `select=*&id=eq.${runIdArg}`
      : `select=id,status,trigger_source,entity_type,records_processed,records_failed,started_at,completed_at,metadata&tenant_id=eq.${TENANT_ID}&order=started_at.desc&limit=5`
  )) as Array<Record<string, unknown>>;

  console.log("sync_runs:", JSON.stringify(runs, null, 2));
  console.log(
    "INNGEST configured:",
    Boolean(process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY)
  );

  for (const run of runs) {
    if (run.status !== "running") continue;
    const events = (await supabaseGet(
      "sync_events",
      `select=status,message,entity_type,created_at&sync_run_id=eq.${run.id}&order=created_at.desc&limit=5`
    )) as Array<Record<string, unknown>>;
    const errors = (await supabaseGet(
      "sync_errors",
      `select=message,external_id,created_at&sync_run_id=eq.${run.id}&order=created_at.desc&limit=10`
    )) as Array<Record<string, unknown>>;
    const eventCount = (await supabaseGet(
      "sync_events",
      `select=id&sync_run_id=eq.${run.id}`
    )) as unknown[];

    console.log("\n--- stuck run", run.id, "---");
    console.log("event count:", eventCount.length);
    console.log("latest events:", events);
    console.log("errors:", errors);
    if (run.started_at) {
      const ageMin =
        (Date.now() - new Date(String(run.started_at)).getTime()) / 60_000;
      console.log("age minutes:", ageMin.toFixed(1));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
