-- MindBody ↔ HubSpot sync app schema

CREATE TYPE tenant_status AS ENUM ('pending', 'active', 'suspended');
CREATE TYPE sync_direction AS ENUM ('mb_to_hs', 'hs_to_mb', 'bidirectional');
CREATE TYPE entity_type AS ENUM ('contact', 'deal');
CREATE TYPE sync_source AS ENUM ('hubspot', 'mindbody', 'manual');
CREATE TYPE webhook_source AS ENUM ('hubspot', 'mindbody');
CREATE TYPE delivery_status AS ENUM ('received', 'queued', 'processed', 'skipped', 'failed');
CREATE TYPE sync_run_status AS ENUM ('running', 'completed', 'failed', 'partial');
CREATE TYPE sync_event_status AS ENUM ('success', 'skipped', 'failed');
CREATE TYPE mindbody_sub_status AS ENUM ('pending', 'active', 'inactive');

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'New tenant',
  status tenant_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE hubspot_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  portal_id BIGINT NOT NULL UNIQUE,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT '{}',
  hub_domain TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE TABLE mindbody_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  site_id INTEGER NOT NULL,
  api_key_encrypted TEXT,
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  oauth_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id),
  UNIQUE (site_id)
);

CREATE TABLE oauth_states (
  state TEXT PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  redirect_after TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sync_settings (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  contacts_enabled BOOLEAN NOT NULL DEFAULT false,
  contacts_direction sync_direction NOT NULL DEFAULT 'mb_to_hs',
  deals_enabled BOOLEAN NOT NULL DEFAULT false,
  deals_direction sync_direction NOT NULL DEFAULT 'mb_to_hs',
  hubspot_properties_bootstrapped BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type entity_type NOT NULL,
  hubspot_property TEXT NOT NULL,
  mindbody_field TEXT NOT NULL,
  is_custom BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, hubspot_property)
);

CREATE TABLE entity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type entity_type NOT NULL,
  hubspot_id TEXT NOT NULL,
  mindbody_id TEXT NOT NULL,
  deal_source TEXT,
  last_source sync_source,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, entity_type, hubspot_id),
  UNIQUE (tenant_id, entity_type, mindbody_id, deal_source)
);

CREATE INDEX idx_entity_mappings_tenant ON entity_mappings(tenant_id, entity_type);

CREATE TABLE mindbody_webhook_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL,
  message_signature_key_encrypted TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  event_ids TEXT[] NOT NULL DEFAULT '{}',
  status mindbody_sub_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  source webhook_source NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  status delivery_status NOT NULL DEFAULT 'received',
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, idempotency_key)
);

CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status, created_at DESC);

CREATE TABLE sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  trigger_source sync_source NOT NULL,
  entity_type entity_type,
  status sync_run_status NOT NULL DEFAULT 'running',
  records_processed INTEGER NOT NULL DEFAULT 0,
  records_failed INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_sync_runs_tenant ON sync_runs(tenant_id, started_at DESC);

CREATE TABLE sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_run_id UUID NOT NULL REFERENCES sync_runs(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type entity_type NOT NULL,
  direction TEXT NOT NULL,
  source_id TEXT,
  target_id TEXT,
  status sync_event_status NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_events_run ON sync_events(sync_run_id);

CREATE TABLE sync_errors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sync_run_id UUID REFERENCES sync_runs(id) ON DELETE SET NULL,
  entity_type entity_type,
  source webhook_source,
  external_id TEXT,
  error_code TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_errors_tenant ON sync_errors(tenant_id, created_at DESC);

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tenants_updated_at BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER hubspot_accounts_updated_at BEFORE UPDATE ON hubspot_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER mindbody_accounts_updated_at BEFORE UPDATE ON mindbody_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER sync_settings_updated_at BEFORE UPDATE ON sync_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER entity_mappings_updated_at BEFORE UPDATE ON entity_mappings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER mindbody_webhook_subscriptions_updated_at BEFORE UPDATE ON mindbody_webhook_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
