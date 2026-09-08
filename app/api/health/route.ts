import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/client";

export const dynamic = "force-dynamic";

/**
 * Lightweight DB ping so a Free-plan Supabase project does not pause.
 * Vercel Cron hits this daily. Visiting the URL also counts as activity.
 */
export async function GET() {
  try {
    const { error } = await getSupabase()
      .from("tenants")
      .select("id")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Supabase health check failed:", error.message);
      return NextResponse.json({ ok: false }, { status: 503 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Supabase health check failed:", error);
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
