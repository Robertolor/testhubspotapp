/**
 * One-off ping so a Free-plan Supabase project does not pause.
 *
 *   npx tsx scripts/keepalive-supabase.ts
 */
import fs from "node:fs";
import path from "node:path";
import { getSupabase } from "../lib/db/client";

function loadEnvLocal(): void {
  const file = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  const { error } = await getSupabase()
    .from("tenants")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  console.log("Supabase ping succeeded. Inactivity timer reset.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
