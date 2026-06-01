import {
  getHubspotClientId,
  getHubspotClientSecret,
  getHubspotRedirectUri,
  HUBSPOT_SCOPES,
} from "@/lib/hubspot/config";

export interface HubspotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export function buildHubspotAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getHubspotClientId(),
    redirect_uri: getHubspotRedirectUri(),
    scope: HUBSPOT_SCOPES,
    state,
  });
  return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeHubspotCode(
  code: string
): Promise<HubspotTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: getHubspotClientId(),
    client_secret: getHubspotClientSecret(),
    redirect_uri: getHubspotRedirectUri(),
    code,
  });

  const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token exchange failed: ${text}`);
  }

  return res.json() as Promise<HubspotTokenResponse>;
}

export async function refreshHubspotToken(
  refreshToken: string
): Promise<HubspotTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: getHubspotClientId(),
    client_secret: getHubspotClientSecret(),
    refresh_token: refreshToken,
  });

  const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot token refresh failed: ${text}`);
  }

  return res.json() as Promise<HubspotTokenResponse>;
}

export async function getHubspotTokenInfo(accessToken: string): Promise<{
  hub_id: number;
  hub_domain: string;
  scopes: string[];
}> {
  const res = await fetch(
    `https://api.hubapi.com/oauth/v1/access-tokens/${accessToken}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch HubSpot token info");
  }
  const data = (await res.json()) as {
    hub_id: number;
    hub_domain: string;
    scopes?: string[];
  };
  return {
    hub_id: data.hub_id,
    hub_domain: data.hub_domain,
    scopes: data.scopes ?? [],
  };
}
