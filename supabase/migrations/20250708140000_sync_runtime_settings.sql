-- Per-tenant runtime sync controls (entity toggles, purchase filters, association toggles).
-- Safe defaults preserve current production behavior.

ALTER TABLE sync_settings
  ADD COLUMN IF NOT EXISTS purchases_min_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS appointments_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visits_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS line_items_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assoc_deal_to_contact BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS assoc_line_item_to_deal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assoc_purchase_to_contract BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN sync_settings.purchases_min_amount IS
  'Skip purchase/sale deals at or below this amount. NULL = no minimum filter.';
COMMENT ON COLUMN sync_settings.appointments_enabled IS
  'When true, sync Mindbody appointments to HubSpot (requires appointment sync implementation).';
COMMENT ON COLUMN sync_settings.visits_enabled IS
  'When true, sync Mindbody visits to HubSpot (requires visit sync implementation).';
COMMENT ON COLUMN sync_settings.line_items_enabled IS
  'When true, sync purchase line items to HubSpot (requires line item sync implementation).';
COMMENT ON COLUMN sync_settings.assoc_deal_to_contact IS
  'When true, associate new/updated deals with the matching HubSpot contact.';
COMMENT ON COLUMN sync_settings.assoc_line_item_to_deal IS
  'When true, associate line items with their purchase deal.';
COMMENT ON COLUMN sync_settings.assoc_purchase_to_contract IS
  'When true, associate purchase deals with related contract deals.';
