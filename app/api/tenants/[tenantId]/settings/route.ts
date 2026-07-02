import { NextRequest, NextResponse } from "next/server";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { getSession } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/client";
import {
  getMindbodyAccountByTenant,
  testMindbodyConnection,
} from "@/lib/mindbody/client";
import {
  issueMindbodyUserToken,
  storeMindbodyUserToken,
  testMindbodyStaffConnection,
} from "@/lib/mindbody/tokens";
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
        .select(
          "site_id, staff_username, staff_password_encrypted, created_at, updated_at"
        )
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
    .select(
      "id, entity_type, hubspot_property, mindbody_field, is_custom, is_system, hubspot_property_type, mindbody_field_type"
    )
    .eq("tenant_id", tenantId);

  return NextResponse.json({
    settings,
    mindbody: mindbody
      ? {
          siteId: mindbody.site_id,
          configured: true,
          staffUsername: mindbody.staff_username ?? undefined,
          staffConfigured: Boolean(mindbody.staff_username),
          staffPasswordConfigured: Boolean(mindbody.staff_password_encrypted),
        }
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
    mindbody?: {
      siteId?: number;
      apiKey?: string;
      staffUsername?: string;
      staffPassword?: string;
    };
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

  if (body.mindbody?.siteId) {
    const existing = await getMindbodyAccountByTenant(tenantId);

    const siteId = body.mindbody.siteId;
    const apiKeyInBody = body.mindbody.apiKey?.trim() ?? "";
    const staffUsernameInBody = body.mindbody.staffUsername?.trim() ?? "";
    const staffPasswordInBody = body.mindbody.staffPassword?.trim() ?? "";

    const mindbodyFieldsTouched =
      Boolean(apiKeyInBody) ||
      Boolean(staffUsernameInBody) ||
      Boolean(staffPasswordInBody) ||
      existing?.site_id !== siteId;

    if (!mindbodyFieldsTouched && existing?.api_key_encrypted) {
      // Sync-only save — keep stored Mindbody credentials; do not re-test Mindbody.
    } else {
    const apiKey =
      apiKeyInBody ||
      (existing?.api_key_encrypted
        ? decryptSecret(existing.api_key_encrypted)
        : null);

    if (!apiKey) {
      return NextResponse.json(
        { error: "Mindbody API key is required" },
        { status: 400 }
      );
    }

    const staffUsername =
      staffUsernameInBody ||
      existing?.staff_username ||
      null;
    const staffPassword =
      staffPasswordInBody ||
      (existing?.staff_password_encrypted
        ? decryptSecret(existing.staff_password_encrypted)
        : null);

    if (!staffUsername || !staffPassword) {
      return NextResponse.json(
        {
          error:
            "Mindbody staff username and password are required for API access.",
        },
        { status: 400 }
      );
    }

    const siteTest = await testMindbodyConnection(siteId, apiKey);
    if (!siteTest.ok) {
      return NextResponse.json({ error: siteTest.message }, { status: 400 });
    }

    if (staffUsername && staffPassword) {
      const staffTest = await testMindbodyStaffConnection(
        siteId,
        apiKey,
        staffUsername,
        staffPassword
      );
      if (!staffTest.ok) {
        return NextResponse.json({ error: staffTest.message }, { status: 400 });
      }
    }

    const credentialsChanged =
      existing?.site_id !== siteId ||
      Boolean(apiKeyInBody) ||
      Boolean(staffUsernameInBody) ||
      Boolean(staffPasswordInBody);

    const upsertRow: Record<string, unknown> = {
      tenant_id: tenantId,
      site_id: siteId,
      api_key_encrypted: encryptSecret(apiKey),
      updated_at: new Date().toISOString(),
    };

    if (staffUsername && staffPassword) {
      upsertRow.staff_username = staffUsername;
      upsertRow.staff_password_encrypted = encryptSecret(staffPassword);
    }

    if (credentialsChanged) {
      upsertRow.access_token_encrypted = null;
      upsertRow.oauth_expires_at = null;
    }

    await supabase.from("mindbody_accounts").upsert(upsertRow, {
      onConflict: "tenant_id",
    });

    if (staffUsername && staffPassword) {
      try {
        const tokenResponse = await issueMindbodyUserToken(
          siteId,
          apiKey,
          staffUsername,
          staffPassword
        );
        await storeMindbodyUserToken(tenantId, tokenResponse);
      } catch (e) {
        console.warn("Mindbody token storage:", e);
      }
    }

    try {
      await ensureMindbodyWebhookSubscription(tenantId, siteId);
    } catch (e) {
      console.warn("Mindbody webhook subscription:", e);
    }
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
