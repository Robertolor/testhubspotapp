-- Inclusive lower bound for Mindbody records on manual test/backfill sync.
-- NULL = no cutoff (current behavior). Apply in Supabase SQL editor if CLI is not linked.

ALTER TABLE sync_settings
  ADD COLUMN IF NOT EXISTS sync_cutoff_date DATE;

COMMENT ON COLUMN sync_settings.sync_cutoff_date IS
  'Inclusive start date for Mindbody history on test sync and backfill. NULL = no cutoff.';
