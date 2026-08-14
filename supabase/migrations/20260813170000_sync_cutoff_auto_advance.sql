-- After a successful manual sync, optionally move sync_cutoff_date forward to today.
-- Apply in Supabase SQL editor if CLI is not linked.

ALTER TABLE sync_settings
  ADD COLUMN IF NOT EXISTS sync_cutoff_auto_advance BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN sync_settings.sync_cutoff_auto_advance IS
  'When true, after a successful manual sync (test or full), set sync_cutoff_date to today so the next pull skips older history.';
