import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";
import { getSupabase } from "@/lib/db/client";
import type { MindbodyAccount } from "@/lib/db/types";
import { MINDBODY_PUBLIC_API } from "@/lib/mindbody/config";

const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface MindbodyUserTokenResponse {
  AccessToken: string;
  Expires: string;
  TokenType?: string;
}

export async function issueMindbodyUserToken(
  siteId: number,
  apiKey: string,
  username: string,
  password: string
): Promise<MindbodyUserTokenResponse> {
  const res = await fetch(`${MINDBODY_PUBLIC_API}/usertoken/issue`, {
    method: "POST",
    headers: {
      "Api-Key": apiKey,
      SiteId: String(siteId),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ Username: username, Password: password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Mindbody staff authentication failed: ${text}`);
  }

  return res.json() as Promise<MindbodyUserTokenResponse>;
}

function getStaffCredentials(account: MindbodyAccount): {
  username: string;
  password: string;
} {
  if (!account.staff_username || !account.staff_password_encrypted) {
    throw new Error(
      "Mindbody staff credentials not configured. Add staff username and password in Settings."
    );
  }
  return {
    username: account.staff_username,
    password: decryptSecret(account.staff_password_encrypted),
  };
}

function tokenStillValid(account: MindbodyAccount): boolean {
  if (!account.access_token_encrypted || !account.oauth_expires_at) {
    return false;
  }
  const expires = new Date(account.oauth_expires_at).getTime();
  return expires - Date.now() > TOKEN_REFRESH_BUFFER_MS;
}

export async function getValidMindbodyUserToken(
  account: MindbodyAccount
): Promise<string> {
  if (tokenStillValid(account)) {
    return decryptSecret(account.access_token_encrypted!);
  }

  const apiKey = account.api_key_encrypted
    ? decryptSecret(account.api_key_encrypted)
    : null;
  if (!apiKey) {
    throw new Error("Mindbody API key not configured for tenant");
  }

  const { username, password } = getStaffCredentials(account);
  const tokenResponse = await issueMindbodyUserToken(
    account.site_id,
    apiKey,
    username,
    password
  );

  const expiresAt = new Date(tokenResponse.Expires).toISOString();

  await getSupabase()
    .from("mindbody_accounts")
    .update({
      access_token_encrypted: encryptSecret(tokenResponse.AccessToken),
      oauth_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", account.tenant_id);

  return tokenResponse.AccessToken;
}

export async function testMindbodyStaffConnection(
  siteId: number,
  apiKey: string,
  username: string,
  password: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const token = await issueMindbodyUserToken(
      siteId,
      apiKey,
      username,
      password
    );
    const res = await fetch(
      `${MINDBODY_PUBLIC_API}/client/clients?Limit=1&Offset=0`,
      {
        headers: {
          "Api-Key": apiKey,
          SiteId: String(siteId),
          Authorization: `Bearer ${token.AccessToken}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!res.ok) {
      return { ok: false, message: await res.text() };
    }
    const data = (await res.json()) as {
      PaginationResponse?: { TotalResults: number };
    };
    const total = data.PaginationResponse?.TotalResults ?? 0;
    return {
      ok: true,
      message: `Staff authentication successful (${total} clients accessible)`,
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Staff connection failed",
    };
  }
}

export async function storeMindbodyUserToken(
  tenantId: string,
  tokenResponse: MindbodyUserTokenResponse
): Promise<void> {
  await getSupabase()
    .from("mindbody_accounts")
    .update({
      access_token_encrypted: encryptSecret(tokenResponse.AccessToken),
      oauth_expires_at: new Date(tokenResponse.Expires).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);
}
