import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { getSupabase } from "@/lib/db/client";
import type { HubspotAccount } from "@/lib/db/types";
import { refreshHubspotToken } from "@/lib/hubspot/oauth";

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

export async function getValidAccessToken(
  account: HubspotAccount
): Promise<string> {
  const expiresAt = new Date(account.expires_at).getTime();
  const bufferMs = 60_000;

  if (expiresAt > Date.now() + bufferMs) {
    return decryptSecret(account.access_token_encrypted);
  }

  const refreshToken = decryptSecret(account.refresh_token_encrypted);
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
}
