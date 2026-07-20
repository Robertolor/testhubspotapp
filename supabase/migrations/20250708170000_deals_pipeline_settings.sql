-- Default HubSpot deal pipeline for Mindbody sync (tenant-configurable).

ALTER TABLE sync_settings
  ADD COLUMN IF NOT EXISTS deals_pipeline_id TEXT;

COMMENT ON COLUMN sync_settings.deals_pipeline_id IS
  'HubSpot deal pipeline ID. When set, new/updated synced deals get pipeline + stage from derived Mindbody status.';
