-- One HubSpot portal still has one Mindbody connection (UNIQUE tenant_id).
-- The same Mindbody site, including sandbox -99, can be used by multiple portals.
ALTER TABLE mindbody_accounts DROP CONSTRAINT IF EXISTS mindbody_accounts_site_id_key;

CREATE INDEX IF NOT EXISTS mindbody_accounts_site_id_idx
  ON mindbody_accounts (site_id);
