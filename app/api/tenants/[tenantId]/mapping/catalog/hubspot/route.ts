import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  listHubspotProperties,
  parseHubspotCatalogObject,
} from "@/lib/hubspot/property-catalog";
import {
  getHubspotAccountByTenant,
  getValidAccessToken,
} from "@/lib/hubspot/tokens";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const session = await getSession();
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const object = parseHubspotCatalogObject(
    request.nextUrl.searchParams.get("object")
  );
  if (!object) {
    return NextResponse.json(
      { error: "Query param object must be contacts, deals, or line_items" },
      { status: 400 }
    );
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
    const properties = await listHubspotProperties(accessToken, object);
    return NextResponse.json({ object, properties });
  } catch (e) {
    console.error("[mapping/catalog/hubspot]", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to load HubSpot properties",
      },
      { status: 502 }
    );
  }
}
