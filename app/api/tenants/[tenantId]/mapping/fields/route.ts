import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  parseMappingEntity,
  toFieldMappingItem,
} from "@/lib/mapping/fields";
import {
  SaveMappingsError,
  saveEntityFieldMappings,
} from "@/lib/mapping/save-field-mappings";
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const session = await getSession();
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    entity?: string;
    mappings?: { hubspotProperty?: string; mindbodyField?: string }[];
  };

  const entity = parseMappingEntity(body.entity ?? null);
  if (!entity) {
    return NextResponse.json(
      { error: "Body entity must be contact or deal" },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.mappings)) {
    return NextResponse.json(
      { error: "Body mappings must be an array" },
      { status: 400 }
    );
  }

  const mappings = body.mappings.map((row) => ({
    hubspotProperty: row.hubspotProperty ?? "",
    mindbodyField: row.mindbodyField ?? "",
  }));

  try {
    const result = await saveEntityFieldMappings(tenantId, entity, mappings);
    return NextResponse.json({
      entity,
      mappings: result.mappings,
      warnings: result.warnings,
    });
  } catch (e) {
    if (e instanceof SaveMappingsError) {
      return NextResponse.json(
        { error: e.message, errors: e.errors },
        { status: 400 }
      );
    }
    console.error("[mapping/fields PUT]", e);
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Failed to save field mappings",
      },
      { status: 500 }
    );
  }
}
