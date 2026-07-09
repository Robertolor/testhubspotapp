-- Expand field mappings for appointments, visits, and line items.

ALTER TYPE entity_type ADD VALUE IF NOT EXISTS 'line_item';

ALTER TABLE field_mappings
  DROP CONSTRAINT IF EXISTS field_mappings_mindbody_source_check;

ALTER TABLE field_mappings
  ADD CONSTRAINT field_mappings_mindbody_source_check
  CHECK (
    mindbody_source IS NULL
    OR mindbody_source IN ('sale', 'contract', 'appointment', 'visit')
  );

ALTER TABLE field_mappings
  DROP CONSTRAINT IF EXISTS field_mappings_tenant_id_entity_type_hubspot_property_key;

CREATE UNIQUE INDEX IF NOT EXISTS field_mappings_unique_target
  ON field_mappings (
    tenant_id,
    entity_type,
    hubspot_property,
    COALESCE(mindbody_source, '')
  );
