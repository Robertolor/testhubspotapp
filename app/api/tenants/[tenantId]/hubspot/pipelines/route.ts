import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listDealPipelines } from "@/lib/hubspot/pipelines";
import {
  getHubspotAccountByTenant,
  getValidAccessToken,
  isHubspotInstallRevokedError,
} from "@/lib/hubspot/tokens";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const session = await getSession();
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hubspotAccount = await getHubspotAccountByTenant(tenantId);
  if (!hubspotAccount) {
    return NextResponse.json(
      { error: "HubSpot is not connected for this tenant" },
      { status: 400 }
    );
  }

  try {
    const accessToken = await getValidAccessToken(hubspotAccount);
    const pipelines = await listDealPipelines(accessToken);
    return NextResponse.json({ pipelines });
  } catch (e) {
    console.error("[hubspot/pipelines]", e);
    if (isHubspotInstallRevokedError(e)) {
      return NextResponse.json(
        { error: "HubSpot was uninstalled. Install the app again." },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: "Could not load HubSpot pipelines." },
      { status: 502 }
    );
  }
}
