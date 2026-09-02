import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/db/client";
import { buildHubspotAuthorizeUrl } from "@/lib/hubspot/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const { error } = await getSupabase().from("oauth_states").insert({
    state,
    tenant_id: null,
    redirect_after: "/setup",
    expires_at: expiresAt,
  });

  if (error) {
    return NextResponse.json(
      { error: "Failed to start OAuth" },
      { status: 500 }
    );
  }

  const response = NextResponse.redirect(buildHubspotAuthorizeUrl(state));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
