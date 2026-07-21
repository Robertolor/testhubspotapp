-- Tenant-configurable Mindbody logical stage → HubSpot stage ID mappings.

ALTER TABLE sync_settings
  ADD COLUMN IF NOT EXISTS deal_stage_mappings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN sync_settings.deal_stage_mappings IS
  'Maps Mindbody logical deal stages (e.g. sale.completed) to HubSpot deal stage IDs for deals_pipeline_id.';
