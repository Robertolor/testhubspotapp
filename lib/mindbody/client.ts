import { decryptSecret } from "@/lib/crypto/secrets";
import { getSupabase } from "@/lib/db/client";
import type { MindbodyAccount } from "@/lib/db/types";
import { MINDBODY_PUBLIC_API } from "@/lib/mindbody/config";
import { getValidMindbodyUserToken } from "@/lib/mindbody/tokens";

export interface MindbodyClientRecord {
  Id: string;
  UniqueId: number;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  MobilePhone?: string;
  HomePhone?: string;
  LastModifiedDateTime?: string;
}

export async function getMindbodyAccountByTenant(
  tenantId: string
): Promise<MindbodyAccount | null> {
  const { data, error } = await getSupabase()
    .from("mindbody_accounts")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return data as MindbodyAccount | null;
}

export async function getMindbodyAccountBySite(
  siteId: number
): Promise<MindbodyAccount | null> {
  const { data, error } = await getSupabase()
    .from("mindbody_accounts")
    .select("*")
    .eq("site_id", siteId)
    .maybeSingle();
  if (error) throw error;
  return data as MindbodyAccount | null;
}

function getApiKey(account: MindbodyAccount): string {
  if (!account.api_key_encrypted) {
    throw new Error("Mindbody API key not configured for tenant");
  }
  return decryptSecret(account.api_key_encrypted);
}

export async function testMindbodyConnection(
  siteId: number,
  apiKey: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await mindbodyRequest(siteId, apiKey, "GET", "/site/sites", {
      Limit: "1",
    });
    if (!res.ok) {
      return { ok: false, message: await res.text() };
    }
    return { ok: true, message: "Connection successful" };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Connection failed",
    };
  }
}

export async function mindbodyRequest(
  siteId: number,
  apiKey: string,
  method: string,
  path: string,
  query?: Record<string, string>,
  body?: unknown,
  accessToken?: string
): Promise<Response> {
  const url = new URL(`${MINDBODY_PUBLIC_API}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    "Api-Key": apiKey,
    SiteId: String(siteId),
    "Content-Type": "application/json",
  };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function mindbodyRequestForAccount(
  account: MindbodyAccount,
  method: string,
  path: string,
  query?: Record<string, string>,
  body?: unknown,
  options?: { requireUserToken?: boolean }
): Promise<Response> {
  const apiKey = getApiKey(account);
  const requireUserToken = options?.requireUserToken ?? true;
  const accessToken = requireUserToken
    ? await getValidMindbodyUserToken(account)
    : undefined;

  return mindbodyRequest(
    account.site_id,
    apiKey,
    method,
    path,
    query,
    body,
    accessToken
  );
}

export async function fetchMindbodyClient(
  account: MindbodyAccount,
  clientId: string
): Promise<MindbodyClientRecord | null> {
  const res = await mindbodyRequestForAccount(
    account,
    "GET",
    "/client/clients",
    { ClientIds: clientId }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { Clients?: MindbodyClientRecord[] };
  return data.Clients?.[0] ?? null;
}

export async function listMindbodyClients(
  account: MindbodyAccount,
  offset: number,
  limit: number
): Promise<MindbodyClientRecord[]> {
  const res = await mindbodyRequestForAccount(
    account,
    "GET",
    "/client/clients",
    {
      Limit: String(limit),
      Offset: String(offset),
    }
  );
  if (!res.ok) {
    throw new Error(`Mindbody list clients failed: ${await res.text()}`);
  }
  const data = (await res.json()) as {
    Clients?: MindbodyClientRecord[];
    PaginationResponse?: { TotalResults: number };
  };
  return data.Clients ?? [];
}

export async function addOrUpdateMindbodyClient(
  account: MindbodyAccount,
  client: {
    FirstName: string;
    LastName: string;
    Email: string;
    MobilePhone?: string;
    Id?: string;
  }
): Promise<string> {
  const res = await mindbodyRequestForAccount(
    account,
    "POST",
    "/client/addclient",
    undefined,
    {
      FirstName: client.FirstName,
      LastName: client.LastName,
      Email: client.Email,
      MobilePhone: client.MobilePhone,
      Id: client.Id,
    }
  );
  if (!res.ok) {
    throw new Error(`Mindbody add/update client failed: ${await res.text()}`);
  }
  const data = (await res.json()) as { Client?: { Id: string } };
  return data.Client?.Id ?? client.Id ?? "";
}

export async function fetchClientContracts(
  account: MindbodyAccount,
  clientId: string
): Promise<Record<string, unknown>[]> {
  const res = await mindbodyRequestForAccount(
    account,
    "GET",
    "/client/clientcontracts",
    { ClientId: clientId }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { Contracts?: Record<string, unknown>[] };
  return data.Contracts ?? [];
}
