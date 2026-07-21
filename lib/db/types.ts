export type TenantStatus = "pending" | "active" | "suspended";
export type SyncDirection = "mb_to_hs" | "hs_to_mb" | "bidirectional";
export type EntityType = "contact" | "deal" | "line_item";
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
  staff_username: string | null;
  staff_password_encrypted: string | null;
  access_token_encrypted: string | null;
  oauth_expires_at: string | null;
}

/** Maps stable Mindbody logical stages to HubSpot deal stage IDs. */
export type DealStageMappings = Partial<
  Record<
    | "sale.completed"
    | "contract.upcoming"
    | "contract.active"
    | "contract.ended"
    | "appointment.scheduled"
    | "appointment.completed"
    | "appointment.no_show"
    | "appointment.cancelled"
    | "visit.attended"
    | "visit.missed"
    | "visit.cancelled",
    string
  >
>;

export interface SyncSettings {
  tenant_id: string;
  contacts_enabled: boolean;
  contacts_direction: SyncDirection;
  deals_enabled: boolean;
  deals_direction: SyncDirection;
  hubspot_properties_bootstrapped: boolean;
  /** Skip purchase/sale deals at or below this amount. null = no filter. */
  purchases_min_amount: number | null;
  appointments_enabled: boolean;
  visits_enabled: boolean;
  line_items_enabled: boolean;
  assoc_deal_to_contact: boolean;
  assoc_line_item_to_deal: boolean;
  assoc_purchase_to_contract: boolean;
  /** HubSpot deal pipeline ID for synced deals. null = HubSpot default behavior. */
  deals_pipeline_id: string | null;
  /** Mindbody logical stage key → HubSpot stage ID for deals_pipeline_id. */
  deal_stage_mappings: DealStageMappings;
}

export type MindbodyMappingSource =
  | "sale"
  | "contract"
  | "appointment"
  | "visit";

/** @deprecated Use MindbodyMappingSource */
export type MindbodyDealSource = MindbodyMappingSource;

export interface FieldMapping {
  id: string;
  tenant_id: string;
  entity_type: EntityType;
  hubspot_property: string;
  mindbody_field: string;
  is_custom: boolean;
  is_system: boolean;
  hubspot_property_type: string | null;
  mindbody_field_type: string | null;
  mindbody_source: MindbodyMappingSource | null;
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
