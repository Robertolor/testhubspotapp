import type { SyncSettings } from "@/lib/db/types";

export type RuntimeEntity =
  | "contact"
  | "deal"
  | "appointment"
  | "visit"
  | "line_item";

export interface PurchaseQualification {
  qualifies: boolean;
  reason?: string;
}

function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/** Whether a purchase/sale should sync given tenant min-amount rules (Gritcity: > $25). */
export function purchaseQualifiesForSync(
  settings: SyncSettings,
  amount: unknown
): PurchaseQualification {
  const min = settings.purchases_min_amount;
  if (min == null) return { qualifies: true };

  const numeric = parseAmount(amount);
  if (numeric == null) {
    return { qualifies: true };
  }

  if (numeric <= min) {
    return {
      qualifies: false,
      reason: `Purchase amount ${numeric} is at or below minimum ${min}`,
    };
  }

  return { qualifies: true };
}

export function isRuntimeEntityEnabled(
  settings: SyncSettings,
  entity: RuntimeEntity
): boolean {
  switch (entity) {
    case "contact":
      return settings.contacts_enabled;
    case "deal":
      return settings.deals_enabled;
    case "appointment":
      return settings.appointments_enabled;
    case "visit":
      return settings.visits_enabled;
    case "line_item":
      return settings.line_items_enabled;
  }
}

export function shouldAssociateDealToContact(settings: SyncSettings): boolean {
  return settings.assoc_deal_to_contact;
}

export function shouldAssociateLineItemToDeal(settings: SyncSettings): boolean {
  return settings.line_items_enabled && settings.assoc_line_item_to_deal;
}

export function shouldAssociatePurchaseToContract(
  settings: SyncSettings
): boolean {
  return settings.deals_enabled && settings.assoc_purchase_to_contract;
}

/** Defaults used when DB columns are missing (pre-migration). */
export function normalizeSyncSettings(
  row: Record<string, unknown>
): SyncSettings {
  return {
    tenant_id: String(row.tenant_id),
    contacts_enabled: Boolean(row.contacts_enabled),
    contacts_direction: row.contacts_direction as SyncSettings["contacts_direction"],
    deals_enabled: Boolean(row.deals_enabled),
    deals_direction: row.deals_direction as SyncSettings["deals_direction"],
    hubspot_properties_bootstrapped: Boolean(row.hubspot_properties_bootstrapped),
    purchases_min_amount:
      row.purchases_min_amount == null
        ? null
        : Number(row.purchases_min_amount),
    appointments_enabled: Boolean(row.appointments_enabled ?? false),
    visits_enabled: Boolean(row.visits_enabled ?? false),
    line_items_enabled: Boolean(row.line_items_enabled ?? false),
    assoc_deal_to_contact: row.assoc_deal_to_contact !== false,
    assoc_line_item_to_deal: Boolean(row.assoc_line_item_to_deal ?? false),
    assoc_purchase_to_contract: Boolean(row.assoc_purchase_to_contract ?? false),
  };
}
