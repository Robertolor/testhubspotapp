import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  parseMappingEntity,
  parseMindbodyMappingSource,
  toFieldMappingItem,
} from "@/lib/mapping/fields";
import {
  SaveMappingsError,
  saveEntityFieldMappings,
} from "@/lib/mapping/save-field-mappings";
import { getFieldMappings, ensureDefaultLineItemMappings } from "@/lib/sync/field-mappings";

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
      { error: "Query param entity must be contact, deal, or line_item" },
      { status: 400 }
    );
  }

  const mindbodySource =
    entity === "deal"
      ? parseMindbodyMappingSource(
          request.nextUrl.searchParams.get("mindbodySource")
        )
      : null;
  if (entity === "deal" && !mindbodySource) {
    return NextResponse.json(
      {
        error:
          "Query param mindbodySource must be sale, contract, appointment, or visit for deals",
      },
      { status: 400 }
    );
  }

  try {
    if (entity === "line_item") {
      await ensureDefaultLineItemMappings(tenantId);
    }
    const rows = await getFieldMappings(
      tenantId,
      entity,
      mindbodySource ? { mindbodySource } : undefined
    );
    return NextResponse.json({
      entity,
      mindbodySource,
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
    mindbodySource?: string;
    mappings?: { hubspotProperty?: string; mindbodyField?: string }[];
  };

  const entity = parseMappingEntity(body.entity ?? null);
  if (!entity) {
    return NextResponse.json(
      { error: "Body entity must be contact, deal, or line_item" },
      { status: 400 }
    );
  }

  const mindbodySource =
    entity === "deal" ? parseMindbodyMappingSource(body.mindbodySource) : null;
  if (entity === "deal" && !mindbodySource) {
    return NextResponse.json(
      {
        error:
          "Body mindbodySource must be sale, contract, appointment, or visit for deal mappings",
      },
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
    const result = await saveEntityFieldMappings(tenantId, entity, mappings, {
      mindbodySource: mindbodySource ?? undefined,
    });
    return NextResponse.json({
      entity,
      mindbodySource,
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
