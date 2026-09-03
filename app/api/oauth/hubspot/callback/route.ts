import { NextRequest, NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto/secrets";
import { getSupabase } from "@/lib/db/client";
import { setSessionCookie } from "@/lib/auth/session";
import {
  exchangeHubspotCode,
  getHubspotTokenInfo,
  type HubspotTokenResponse,
} from "@/lib/hubspot/oauth";
import { ensureHubspotWebhookSubscriptions } from "@/lib/hubspot/webhooks-register";
import { bootstrapHubspotProperties } from "@/lib/hubspot/properties";
import { seedDefaultFieldMappings } from "@/lib/sync/field-mappings";
import { resumeStripeIfScheduled } from "@/lib/billing/lifecycle";
import { getAppUrl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${getAppUrl()}/?error=${encodeURIComponent(error)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${getAppUrl()}/?error=missing_code`);
  }

  let tenantIdFromState: string | null = null;
  let redirectAfter = "/setup";

  if (state) {
    const { data: oauthState, error: stateError } = await getSupabase()
      .from("oauth_states")
      .select("*")
      .eq("state", state)
      .maybeSingle();

    if (oauthState && !stateError) {
      if (new Date(oauthState.expires_at) < new Date()) {
        return NextResponse.redirect(`${getAppUrl()}/?error=state_expired`);
      }
      tenantIdFromState = (oauthState.tenant_id as string | null) ?? null;
      redirectAfter = oauthState.redirect_after || "/setup";
      await getSupabase().from("oauth_states").delete().eq("state", state);
    }
  }

  let tokens: HubspotTokenResponse;
  try {
    tokens = await exchangeHubspotCode(code);
  } catch (e) {
    console.error("HubSpot OAuth code exchange failed:", e);
    return NextResponse.redirect(`${getAppUrl()}/?error=oauth_failed`);
  }

  const tokenInfo = await getHubspotTokenInfo(tokens.access_token);
  const portalId = tokenInfo.hub_id;
  const expiresAt = new Date(
    Date.now() + tokens.expires_in * 1000
  ).toISOString();

  let tenantId = tenantIdFromState;

  const { data: existingHs } = await getSupabase()
    .from("hubspot_accounts")
    .select("tenant_id")
    .eq("portal_id", portalId)
    .maybeSingle();

  if (existingHs) {
    tenantId = existingHs.tenant_id;
  }

  if (!tenantId) {
    const { data: tenant, error: tenantError } = await getSupabase()
      .from("tenants")
      .insert({
        name: `HubSpot ${portalId}`,
        status: "active",
      })
      .select("id")
      .single();

    if (tenantError || !tenant) {
      return NextResponse.redirect(`${getAppUrl()}/?error=tenant_create`);
    }
    tenantId = tenant.id as string;

    await getSupabase().from("sync_settings").insert({ tenant_id: tenantId });
    await seedDefaultFieldMappings(tenantId);
  }

  if (!tenantId) {
    return NextResponse.redirect(`${getAppUrl()}/?error=tenant_create`);
  }

  await getSupabase().from("hubspot_accounts").upsert(
    {
      tenant_id: tenantId,
      portal_id: portalId,
      access_token_encrypted: encryptSecret(tokens.access_token),
      refresh_token_encrypted: encryptSecret(tokens.refresh_token),
      expires_at: expiresAt,
      scopes: tokenInfo.scopes,
      hub_domain: tokenInfo.hub_domain,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "portal_id" }
  );

  await getSupabase()
    .from("tenants")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", tenantId);

  try {
    await resumeStripeIfScheduled(tenantId);
  } catch (e) {
    console.warn("Resume Stripe after HubSpot reinstall:", e);
  }

  try {
    await bootstrapHubspotProperties(tokens.access_token);
    await getSupabase()
      .from("sync_settings")
      .update({ hubspot_properties_bootstrapped: true })
      .eq("tenant_id", tenantId);
  } catch (e) {
    console.warn("HubSpot property bootstrap:", e);
  }

  try {
    await ensureHubspotWebhookSubscriptions(tokens.access_token, portalId);
  } catch (e) {
    console.warn("HubSpot webhook registration:", e);
  }

  await setSessionCookie(tenantId, portalId);

  return NextResponse.redirect(`${getAppUrl()}${redirectAfter}`);
}
