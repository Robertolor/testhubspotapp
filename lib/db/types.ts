export type TenantStatus = "pending" | "active" | "suspended";
export type SyncDirection = "mb_to_hs" | "hs_to_mb" | "bidirectional";
export type EntityType = "contact" | "deal";
export type SyncSource = "hubspot" | "mindbody" | "manual";
export type WebhookSource = "hubspot" | "mindbody";
export type DeliveryStatus =
  | "received"
  | "queued"
  | "processed"
  | "skipped"
  | "failed";
export type SyncRunStatus = "running" | "completed" | "failed" | "partial";
export type SyncEventStatus = "success" | "skipped" | "failed";

export interface Tenant {
  id: string;
  name: string;
  status: TenantStatus;
  created_at: string;
  updated_at: string;
}

export interface HubspotAccount {
  id: string;
  tenant_id: string;
  portal_id: number;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  expires_at: string;
  scopes: string[];
  hub_domain: string | null;
}

export interface MindbodyAccount {
  id: string;
  tenant_id: string;
  site_id: number;
  api_key_encrypted: string | null;
}

export interface SyncSettings {
  tenant_id: string;
  contacts_enabled: boolean;
  contacts_direction: SyncDirection;
  deals_enabled: boolean;
  deals_direction: SyncDirection;
  hubspot_properties_bootstrapped: boolean;
}

export interface FieldMapping {
  id: string;
  tenant_id: string;
  entity_type: EntityType;
  hubspot_property: string;
  mindbody_field: string;
  is_custom: boolean;
}

export interface EntityMapping {
  id: string;
  tenant_id: string;
  entity_type: EntityType;
  hubspot_id: string;
  mindbody_id: string;
  deal_source: string | null;
  last_source: SyncSource | null;
  last_synced_at: string | null;
}

export interface SyncRun {
  id: string;
  tenant_id: string;
  trigger_source: SyncSource;
  entity_type: EntityType | null;
  status: SyncRunStatus;
  records_processed: number;
  records_failed: number;
  started_at: string;
  completed_at: string | null;
  metadata: Record<string, unknown>;
}

export interface SyncError {
  id: string;
  tenant_id: string;
  sync_run_id: string | null;
  entity_type: EntityType | null;
  source: WebhookSource | null;
  external_id: string | null;
  error_code: string | null;
  message: string;
  created_at: string;
}

export interface MindbodyWebhookSubscription {
  id: string;
  tenant_id: string;
  subscription_id: string;
  message_signature_key_encrypted: string;
  webhook_url: string;
  event_ids: string[];
  status: "pending" | "active" | "inactive";
}
