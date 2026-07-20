import { getSupabase } from "@/lib/db/client";
import type {
  HubspotAccount,
  MindbodyAccount,
  SyncSettings,
} from "@/lib/db/types";
import {
  associateLineItemToDeal,
  createLineItem,
  updateLineItem,
} from "@/lib/hubspot/line-items";
import { getValidAccessToken } from "@/lib/hubspot/tokens";
import { listMindbodyClientPurchases } from "@/lib/mindbody/client";
import type { SyncWriteAction } from "@/lib/sync/deals";
import {
  applyLineItemMappings,
  getFieldMappings,
} from "@/lib/sync/field-mappings";
import { findExistingLineItemHubspotId } from "@/lib/sync/line-item-lookup";
import { extractLineItemsForSale } from "@/lib/sync/purchase-line-items";
import { shouldAssociateLineItemToDeal } from "@/lib/sync/runtime-rules";

const PURCHASE_LOOKBACK_DAYS = 365;

export type SyncLineItemResult = {
  lineItemKey: string;
  hubspotId: string;
  action: SyncWriteAction;
};

function isoDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function boolForHubspot(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return value === true || value === "true" ? "true" : "false";
}

export async function syncLineItemToHubspot(
  tenantId: string,
  hubspotAccount: HubspotAccount,
  settings: SyncSettings,
  payload: Record<string, unknown>,
  dealHubspotId?: string
): Promise<SyncLineItemResult> {
  if (!settings.line_items_enabled) {
    throw new Error("Line item sync is disabled");
  }

  const lineItemKey = String(payload.line_item_key ?? "");
  if (!lineItemKey) {
    throw new Error("Missing line_item_key");
  }

  const accessToken = await getValidAccessToken(hubspotAccount);
  let hubspotId = await findExistingLineItemHubspotId(
    tenantId,
    accessToken,
    lineItemKey
  );

  const mappings = await getFieldMappings(tenantId, "line_item");
  const lineItemProps = {
    ...applyLineItemMappings(mappings, payload),
    name: String(payload.name ?? "Line item"),
    description:
      payload.description != null ? String(payload.description) : undefined,
    quantity:
      payload.quantity != null ? String(payload.quantity) : undefined,
    price: payload.unit_price != null ? String(payload.unit_price) : undefined,
    amount: payload.line_total != null ? String(payload.line_total) : undefined,
    mindbody_line_item_key: lineItemKey,
    mindbody_sale_id:
      payload.mindbody_sale_id != null
        ? String(payload.mindbody_sale_id)
        : undefined,
    mindbody_sale_detail_id:
      payload.sale_detail_id != null ? String(payload.sale_detail_id) : undefined,
    mindbody_item_id:
      payload.item_id != null ? String(payload.item_id) : undefined,
    mindbody_contract_id:
      payload.contract_id != null ? String(payload.contract_id) : undefined,
    mindbody_recipient_client_id:
      payload.recipient_client_id != null
        ? String(payload.recipient_client_id)
        : undefined,
    mindbody_is_service: boolForHubspot(payload.is_service),
    mindbody_category_id:
      payload.category_id != null ? String(payload.category_id) : undefined,
    mindbody_subcategory_id:
      payload.subcategory_id != null
        ? String(payload.subcategory_id)
        : undefined,
    mindbody_returned: boolForHubspot(payload.returned),
  };

  let action: SyncWriteAction;
  if (hubspotId) {
    await updateLineItem(accessToken, hubspotId, lineItemProps);
    action = "updated";
  } else {
    const associateOnCreate =
      shouldAssociateLineItemToDeal(settings) && dealHubspotId
        ? dealHubspotId
        : undefined;
    hubspotId = await createLineItem(
      accessToken,
      lineItemProps,
      associateOnCreate
    );
    action = "created";
  }

  if (
    shouldAssociateLineItemToDeal(settings) &&
    dealHubspotId &&
    action === "updated"
  ) {
    await associateLineItemToDeal(accessToken, hubspotId, dealHubspotId);
  }

  await getSupabase().from("entity_mappings").upsert(
    {
      tenant_id: tenantId,
      entity_type: "line_item",
      hubspot_id: hubspotId,
      mindbody_id: lineItemKey,
      deal_source: null,
      last_source: "mindbody",
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id,entity_type,hubspot_id" }
  );

  return { lineItemKey, hubspotId, action };
}

export async function syncLineItemsForSale(
  tenantId: string,
  hubspotAccount: HubspotAccount,
  mindbodyAccount: MindbodyAccount,
  settings: SyncSettings,
  saleId: string,
  clientId: string,
  dealHubspotId: string
): Promise<SyncLineItemResult[]> {
  if (!settings.line_items_enabled || !clientId || !saleId) {
    return [];
  }

  const purchases = await listMindbodyClientPurchases(mindbodyAccount, {
    clientId,
    startDate: isoDateDaysAgo(PURCHASE_LOOKBACK_DAYS),
    endDate: isoDateDaysAgo(0),
    offset: 0,
    limit: 200,
  });

  const lineItemPayloads = extractLineItemsForSale(purchases, saleId);
  const results: SyncLineItemResult[] = [];

  for (const payload of lineItemPayloads) {
    results.push(
      await syncLineItemToHubspot(
        tenantId,
        hubspotAccount,
        settings,
        payload,
        dealHubspotId
      )
    );
  }

  return results;
}
