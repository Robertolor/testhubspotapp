import {
  getHubspotClientId,
  getHubspotClientSecret,
  getHubspotRedirectUri,
  HUBSPOT_SCOPES,
} from "@/lib/hubspot/config";

/** Date-versioned OAuth API required for new HubSpot Marketplace listings. */
export const HUBSPOT_OAUTH_TOKEN_URL =
  "https://api.hubapi.com/oauth/2026-03/token";
export const HUBSPOT_OAUTH_INTROSPECT_URL =
  "https://api.hubapi.com/oauth/2026-03/token/introspect";

export interface HubspotTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  hub_id?: number;
  scopes?: string[];
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

async function postForm(
  url: string,
  body: URLSearchParams,
  errorPrefix: string
): Promise<Response> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${errorPrefix}: ${text}`);
  }

  return res;
}

export async function exchangeHubspotCode(
  code: string
): Promise<HubspotTokenResponse> {
  const res = await postForm(
    HUBSPOT_OAUTH_TOKEN_URL,
    new URLSearchParams({
      grant_type: "authorization_code",
      client_id: getHubspotClientId(),
      client_secret: getHubspotClientSecret(),
      redirect_uri: getHubspotRedirectUri(),
      code,
    }),
    "HubSpot token exchange failed"
  );

  return res.json() as Promise<HubspotTokenResponse>;
}

export async function refreshHubspotToken(
  refreshToken: string
): Promise<HubspotTokenResponse> {
  const res = await postForm(
    HUBSPOT_OAUTH_TOKEN_URL,
    new URLSearchParams({
      grant_type: "refresh_token",
      client_id: getHubspotClientId(),
      client_secret: getHubspotClientSecret(),
      refresh_token: refreshToken,
    }),
    "HubSpot token refresh failed"
  );

  return res.json() as Promise<HubspotTokenResponse>;
}

export async function getHubspotTokenInfo(accessToken: string): Promise<{
  hub_id: number;
  hub_domain: string;
  scopes: string[];
}> {
  const res = await postForm(
    HUBSPOT_OAUTH_INTROSPECT_URL,
    new URLSearchParams({
      client_id: getHubspotClientId(),
      client_secret: getHubspotClientSecret(),
      token_type_hint: "access_token",
      token: accessToken,
    }),
    "Failed to fetch HubSpot token info"
  );

  const data = (await res.json()) as {
    hub_id?: number;
    hub_domain?: string;
    scopes?: string[];
    active?: boolean;
  };

  if (data.active === false) {
    throw new Error("HubSpot access token is not active");
  }

  if (!data.hub_id) {
    throw new Error("HubSpot token introspect response missing hub_id");
  }

  return {
    hub_id: data.hub_id,
    hub_domain: data.hub_domain ?? "",
    scopes: data.scopes ?? [],
  };
}
