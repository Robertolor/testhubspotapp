import {
  normalizeSyncSettings,
  purchaseQualifiesForSync,
  shouldAssociateDealToContact,
  shouldAssociateLineItemToDeal,
} from "./runtime-rules";
import type { SyncSettings } from "@/lib/db/types";

function baseSettings(overrides: Partial<SyncSettings> = {}): SyncSettings {
  return {
    tenant_id: "test",
    contacts_enabled: true,
    contacts_direction: "mb_to_hs",
    deals_enabled: true,
    deals_direction: "mb_to_hs",
    hubspot_properties_bootstrapped: true,
    purchases_min_amount: null,
    sync_cutoff_date: null,
    sync_cutoff_auto_advance: false,
    appointments_enabled: false,
    visits_enabled: false,
    line_items_enabled: false,
    assoc_deal_to_contact: true,
    assoc_line_item_to_deal: false,
    assoc_purchase_to_contract: false,
    deals_pipeline_id: null,
    deal_stage_mappings: {},
    ...overrides,
  };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

export function runRuntimeRulesSelfCheck(): void {
  assert(purchaseQualifiesForSync(baseSettings(), 100).qualifies, "no min");
  assert(
    !purchaseQualifiesForSync(baseSettings({ purchases_min_amount: 25 }), 25)
      .qualifies,
    "at min excluded"
  );
  assert(
    purchaseQualifiesForSync(baseSettings({ purchases_min_amount: 25 }), 25.01)
      .qualifies,
    "above min included"
  );
  assert(shouldAssociateDealToContact(baseSettings()), "deal contact default");
  assert(
    !shouldAssociateDealToContact(
      baseSettings({ assoc_deal_to_contact: false })
    ),
    "deal contact off"
  );
  assert(
    !shouldAssociateLineItemToDeal(
      baseSettings({ line_items_enabled: false, assoc_line_item_to_deal: true })
    ),
    "line item assoc needs line_items_enabled"
  );
  assert(
    shouldAssociateLineItemToDeal(
      baseSettings({ line_items_enabled: true, assoc_line_item_to_deal: true })
    ),
    "line item assoc when enabled"
  );

  const normalized = normalizeSyncSettings({
    tenant_id: "t1",
    contacts_enabled: true,
    contacts_direction: "mb_to_hs",
    deals_enabled: false,
    deals_direction: "mb_to_hs",
    hubspot_properties_bootstrapped: false,
  });
  assert(normalized.assoc_deal_to_contact === true, "normalize defaults assoc");
  assert(normalized.appointments_enabled === false, "normalize defaults entity");
  assert(normalized.sync_cutoff_date === null, "normalize defaults cutoff");
  assert(
    normalized.sync_cutoff_auto_advance === false,
    "normalize defaults auto advance"
  );
}

if (require.main === module) {
  runRuntimeRulesSelfCheck();
  console.log("runtime-rules self-check passed");
}
