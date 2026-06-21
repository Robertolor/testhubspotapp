import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  parseMappingEntity,
  toFieldMappingItem,
} from "@/lib/mapping/fields";
import { getFieldMappings } from "@/lib/sync/field-mappings";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const session = await getSession();
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entity = parseMappingEntity(request.nextUrl.searchParams.get("entity"));
  if (!entity) {
    return NextResponse.json(
      { error: "Query param entity must be contact or deal" },
      { status: 400 }
    );
  }

  try {
    const rows = await getFieldMappings(tenantId, entity);
    return NextResponse.json({
      entity,
      mappings: rows.map(toFieldMappingItem),
    });
  } catch (e) {
    console.error("[mapping/fields]", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to load field mappings",
      },
      { status: 500 }
    );
  }
}
