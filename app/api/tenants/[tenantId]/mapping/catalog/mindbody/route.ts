import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getMindbodyAccountByTenant } from "@/lib/mindbody/client";
import {
  listMindbodyContactFields,
  parseMindbodyCatalogEntity,
} from "@/lib/mindbody/field-catalog";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const session = await getSession();
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entity = parseMindbodyCatalogEntity(
    request.nextUrl.searchParams.get("entity")
  );
  if (!entity) {
    return NextResponse.json(
      { error: "Query param entity must be contact" },
      { status: 400 }
    );
  }

  const mindbodyAccount = await getMindbodyAccountByTenant(tenantId);
  if (!mindbodyAccount?.api_key_encrypted) {
    return NextResponse.json(
      { error: "Mindbody is not configured for this tenant" },
      { status: 400 }
    );
  }

  try {
    const fields = await listMindbodyContactFields(mindbodyAccount);
    return NextResponse.json({ entity, fields });
  } catch (e) {
    console.error("[mapping/catalog/mindbody]", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "Failed to load Mindbody contact fields",
      },
      { status: 502 }
    );
  }
}
