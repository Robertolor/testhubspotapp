import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { getSupabase } from "@/lib/db/client";
import type { HubspotAccount } from "@/lib/db/types";
import { getHubspotTokenInfo, refreshHubspotToken } from "@/lib/hubspot/oauth";

export async function getHubspotAccountByPortal(
  portalId: number
): Promise<HubspotAccount | null> {
  const { data, error } = await getSupabase()
    .from("hubspot_accounts")
    .select("*")
    .eq("portal_id", portalId)
    .maybeSingle();

  if (error) throw error;
  return data as HubspotAccount | null;
}

export async function getHubspotAccountByTenant(
  tenantId: string
): Promise<HubspotAccount | null> {
  const { data, error } = await getSupabase()
    .from("hubspot_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (error) throw error;
  return data as HubspotAccount | null;
}

async function isAccessTokenActive(accessToken: string): Promise<boolean> {
  try {
    await getHubspotTokenInfo(accessToken);
    return true;
  } catch {
    return false;
  }
}

export class HubspotInstallRevokedError extends Error {
  readonly code = "HUBSPOT_INSTALL_REVOKED";

  constructor() {
    super("HubSpot app was uninstalled");
    this.name = "HubspotInstallRevokedError";
  }
}

export function isHubspotInstallRevokedError(error: unknown): boolean {
  return (
    error instanceof HubspotInstallRevokedError ||
    (error instanceof Error &&
      (error.name === "HubspotInstallRevokedError" ||
        ("code" in error && error.code === "HUBSPOT_INSTALL_REVOKED")))
  );
}

async function cancelBillingAfterHubspotUninstall(portalId: number): Promise<void> {
  const { cancelStripeForPortal } = await import("@/lib/billing/uninstall");
  await cancelStripeForPortal(portalId);
}

/**
 * HubSpot has no app.uninstall webhook. A revoked OAuth token is uninstall:
 * schedule Stripe cancel at period/trial end so a quick reinstall can keep the plan.
 */
export async function getValidAccessToken(
  account: HubspotAccount
): Promise<string> {
  const expiresAt = new Date(account.expires_at).getTime();
  const bufferMs = 60_000;

  if (expiresAt > Date.now() + bufferMs) {
    const current = decryptSecret(account.access_token_encrypted);
    if (await isAccessTokenActive(current)) {
      return current;
    }
  }

  const refreshToken = decryptSecret(account.refresh_token_encrypted);
  try {
    const tokens = await refreshHubspotToken(refreshToken);
    const expires = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const { error } = await getSupabase()
      .from("hubspot_accounts")
      .update({
        access_token_encrypted: encryptSecret(tokens.access_token),
        refresh_token_encrypted: encryptSecret(
          tokens.refresh_token || refreshToken
        ),
        expires_at: expires,
        updated_at: new Date().toISOString(),
      })
      .eq("id", account.id);

    if (error) throw error;
    return tokens.access_token;
  } catch (error) {
    if (isRevokedHubspotRefresh(error)) {
      await cancelBillingAfterHubspotUninstall(account.portal_id);
      throw new HubspotInstallRevokedError();
    }
    throw error;
  }
}

export function isRevokedHubspotRefresh(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("bad_refresh_token") ||
    message.includes("invalid_grant") ||
    message.includes("invalid refresh token") ||
    message.includes("missing or invalid refresh token")
  );
}
