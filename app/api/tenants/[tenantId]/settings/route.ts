import { NextRequest, NextResponse } from "next/server";
import { encryptSecret } from "@/lib/crypto/secrets";
import { getSession } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/client";
import { testMindbodyConnection } from "@/lib/mindbody/client";
import { ensureMindbodyWebhookSubscription } from "@/lib/mindbody/webhooks-subscribe";

async function assertTenantAccess(tenantId: string) {
  const session = await getSession();
  if (!session || session.tenantId !== tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const denied = await assertTenantAccess(tenantId);
  if (denied) return denied;

  const supabase = getSupabase();

  const [{ data: settings }, { data: mindbody }, { data: hubspot }] =
    await Promise.all([
      supabase.from("sync_settings").select("*").eq("tenant_id", tenantId).single(),
      supabase
        .from("mindbody_accounts")
        .select("site_id, created_at, updated_at")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
      supabase
        .from("hubspot_accounts")
        .select("portal_id, hub_domain, expires_at")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

  const { data: mappings } = await supabase
    .from("field_mappings")
    .select("id, entity_type, hubspot_property, mindbody_field, is_custom")
    .eq("tenant_id", tenantId);

  return NextResponse.json({
    settings,
    mindbody: mindbody
      ? { siteId: mindbody.site_id, configured: true }
      : { configured: false },
    hubspot: hubspot
      ? {
          portalId: hubspot.portal_id,
          hubDomain: hubspot.hub_domain,
        }
      : null,
    fieldMappings: mappings ?? [],
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const denied = await assertTenantAccess(tenantId);
  if (denied) return denied;

  const body = (await request.json()) as {
    mindbody?: { siteId: number; apiKey: string };
    sync?: {
      contactsEnabled?: boolean;
      contactsDirection?: string;
      dealsEnabled?: boolean;
      dealsDirection?: string;
    };
    fieldMappings?: {
      entityType: string;
      hubspotProperty: string;
      mindbodyField: string;
    }[];
  };

  const supabase = getSupabase();

  if (body.sync) {
    await supabase
      .from("sync_settings")
      .update({
        contacts_enabled: body.sync.contactsEnabled,
        contacts_direction: body.sync.contactsDirection,
        deals_enabled: body.sync.dealsEnabled,
        deals_direction: body.sync.dealsDirection,
        updated_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId);
  }

  if (body.mindbody?.siteId && body.mindbody?.apiKey) {
    const test = await testMindbodyConnection(
      body.mindbody.siteId,
      body.mindbody.apiKey
    );
    if (!test.ok) {
      return NextResponse.json({ error: test.message }, { status: 400 });
    }

    await supabase.from("mindbody_accounts").upsert(
      {
        tenant_id: tenantId,
        site_id: body.mindbody.siteId,
        api_key_encrypted: encryptSecret(body.mindbody.apiKey),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );

    try {
      await ensureMindbodyWebhookSubscription(tenantId, body.mindbody.siteId);
    } catch (e) {
      console.warn("Mindbody webhook subscription:", e);
    }
  }

  if (body.fieldMappings?.length) {
    for (const m of body.fieldMappings) {
      await supabase.from("field_mappings").upsert(
        {
          tenant_id: tenantId,
          entity_type: m.entityType,
          hubspot_property: m.hubspotProperty,
          mindbody_field: m.mindbodyField,
        },
        { onConflict: "tenant_id,entity_type,hubspot_property" }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
