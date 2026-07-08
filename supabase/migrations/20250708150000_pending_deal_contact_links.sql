-- Queue deal->contact links when webhooks arrive out of order.
-- Example: sale/contract webhook arrives before client contact sync.

CREATE TABLE IF NOT EXISTS pending_deal_contact_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  deal_hubspot_id TEXT NOT NULL,
  mindbody_client_id TEXT NOT NULL,
  reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, deal_hubspot_id, mindbody_client_id)
);

CREATE INDEX IF NOT EXISTS idx_pending_deal_contact_links_tenant_next_attempt
  ON pending_deal_contact_links(tenant_id, next_attempt_at ASC);

CREATE TRIGGER pending_deal_contact_links_updated_at
BEFORE UPDATE ON pending_deal_contact_links
FOR EACH ROW EXECUTE FUNCTION update_updated_at();
