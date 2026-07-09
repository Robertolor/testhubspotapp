import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getMindbodyAccountByTenant } from "@/lib/mindbody/client";
import {
  listMindbodyContactFields,
  parseMindbodyCatalogEntity,
} from "@/lib/mindbody/field-catalog";
import {
  listMindbodyAppointmentFields,
  listMindbodyContractFields,
  listMindbodySaleFields,
  listMindbodyVisitFields,
  parseMindbodyDealCatalogEntity,
} from "@/lib/mindbody/deal-field-catalog";
import { listMindbodyLineItemFields } from "@/lib/mindbody/line-item-field-catalog";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const session = await getSession();
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entityParam = request.nextUrl.searchParams.get("entity");
  const contactEntity = parseMindbodyCatalogEntity(entityParam);
  const dealEntity = parseMindbodyDealCatalogEntity(entityParam);

  if (entityParam === "line_item") {
    const fields = listMindbodyLineItemFields();
    return NextResponse.json({
      entity: "line_item",
      fields: fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        groupName: "line_item",
        isCustom: false,
      })),
    });
  }

  if (!contactEntity && !dealEntity) {
    return NextResponse.json(
      {
        error:
          "Query param entity must be contact, sale, contract, appointment, visit, or line_item",
      },
      { status: 400 }
    );
  }

  if (dealEntity) {
    const fields =
      dealEntity === "sale"
        ? listMindbodySaleFields()
        : dealEntity === "contract"
          ? listMindbodyContractFields()
          : dealEntity === "appointment"
            ? listMindbodyAppointmentFields()
            : listMindbodyVisitFields();
    return NextResponse.json({
      entity: dealEntity,
      fields: fields.map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        groupName: field.source,
        isCustom: false,
      })),
    });
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
    return NextResponse.json({ entity: contactEntity, fields });
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
