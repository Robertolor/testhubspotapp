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
import { ensureDefaultLineItemMappings } from "@/lib/sync/field-mappings";

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

  // Idempotent suggested defaults; never overwrites remaps.
  await ensureDefaultLineItemMappings(tenantId);

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

  try {
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
      purchasesMinAmount?: number | null;
      appointmentsEnabled?: boolean;
      visitsEnabled?: boolean;
      lineItemsEnabled?: boolean;
      assocDealToContact?: boolean;
      assocLineItemToDeal?: boolean;
      assocPurchaseToContract?: boolean;
      dealsPipelineId?: string | null;
    };
    fieldMappings?: {
      entityType: string;
      hubspotProperty: string;
      mindbodyField: string;
    }[];
  };

  const supabase = getSupabase();

  if (body.sync) {
    const syncUpdate: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.sync.contactsEnabled !== undefined) {
      syncUpdate.contacts_enabled = body.sync.contactsEnabled;
    }
    if (body.sync.contactsDirection !== undefined) {
      syncUpdate.contacts_direction = body.sync.contactsDirection;
    }
    if (body.sync.dealsEnabled !== undefined) {
      syncUpdate.deals_enabled = body.sync.dealsEnabled;
    }
    if (body.sync.dealsDirection !== undefined) {
      syncUpdate.deals_direction = body.sync.dealsDirection;
    }
    if (body.sync.purchasesMinAmount !== undefined) {
      syncUpdate.purchases_min_amount = body.sync.purchasesMinAmount;
    }
    if (body.sync.appointmentsEnabled !== undefined) {
      syncUpdate.appointments_enabled = body.sync.appointmentsEnabled;
    }
    if (body.sync.visitsEnabled !== undefined) {
      syncUpdate.visits_enabled = body.sync.visitsEnabled;
    }
    if (body.sync.lineItemsEnabled !== undefined) {
      syncUpdate.line_items_enabled = body.sync.lineItemsEnabled;
      if (body.sync.lineItemsEnabled) {
        await ensureDefaultLineItemMappings(tenantId);
      }
    }
    if (body.sync.assocDealToContact !== undefined) {
      syncUpdate.assoc_deal_to_contact = body.sync.assocDealToContact;
    }
    if (body.sync.assocLineItemToDeal !== undefined) {
      syncUpdate.assoc_line_item_to_deal = body.sync.assocLineItemToDeal;
    }
    if (body.sync.assocPurchaseToContract !== undefined) {
      syncUpdate.assoc_purchase_to_contract = body.sync.assocPurchaseToContract;
    }
    if (body.sync.dealsPipelineId !== undefined) {
      const pipelineId = body.sync.dealsPipelineId?.trim();
      syncUpdate.deals_pipeline_id = pipelineId ? pipelineId : null;
    }

    await supabase
      .from("sync_settings")
      .update(syncUpdate)
      .eq("tenant_id", tenantId);
  }

  if (body.mindbody?.siteId) {
    const existing = await getMindbodyAccountByTenant(tenantId);

    const siteId = body.mindbody.siteId;
    const apiKeyInBody = body.mindbody.apiKey?.trim() ?? "";
    const staffUsernameInBody = body.mindbody.staffUsername?.trim() ?? "";
    const staffPasswordInBody = body.mindbody.staffPassword?.trim() ?? "";

    const staffUsernameChanged =
      Boolean(staffUsernameInBody) &&
      staffUsernameInBody !== (existing?.staff_username ?? "");
    const mindbodyFieldsTouched =
      Boolean(apiKeyInBody) ||
      Boolean(staffPasswordInBody) ||
      staffUsernameChanged ||
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
      staffUsernameChanged ||
      Boolean(staffPasswordInBody);

    const upsertRow: Record<string, unknown> = {
      tenant_id: tenantId,
      site_id: siteId,
      api_key_encrypted: encryptSecret(apiKey),
      staff_username: staffUsername,
      staff_password_encrypted: encryptSecret(staffPassword),
      updated_at: new Date().toISOString(),
    };

    if (credentialsChanged) {
      upsertRow.access_token_encrypted = null;
      upsertRow.oauth_expires_at = null;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("mindbody_accounts")
        .update(upsertRow)
        .eq("tenant_id", tenantId);
      if (updateError) {
        return NextResponse.json(
          { error: updateError.message ?? "Failed to update Mindbody account" },
          { status: 500 }
        );
      }
    } else {
      const { error: insertError } = await supabase
        .from("mindbody_accounts")
        .insert(upsertRow);
      if (insertError) {
        return NextResponse.json(
          { error: insertError.message ?? "Failed to save Mindbody account" },
          { status: 500 }
        );
      }
    }

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
  } catch (e) {
    console.error("[settings] PUT failed:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Failed to save settings",
      },
      { status: 500 }
    );
  }
}
