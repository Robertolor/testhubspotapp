-- Step 2.1: mapping metadata for locked rows and type-aware validation/UI
ALTER TABLE field_mappings
  ADD COLUMN is_system BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN hubspot_property_type TEXT,
  ADD COLUMN mindbody_field_type TEXT;

-- Locked contact identity mappings
UPDATE field_mappings
SET is_system = true
WHERE entity_type = 'contact'
  AND hubspot_property IN ('email', 'mindbody_client_id');

-- Backfill known default contact mappings
UPDATE field_mappings
SET
  hubspot_property_type = 'string',
  mindbody_field_type = 'string'
WHERE entity_type = 'contact'
  AND hubspot_property IN (
    'email',
    'firstname',
    'lastname',
    'phone',
    'mindbody_client_id'
  );

-- Backfill known default deal mappings
UPDATE field_mappings
SET
  hubspot_property_type = 'string',
  mindbody_field_type = 'string'
WHERE entity_type = 'deal'
  AND hubspot_property = 'dealname';

UPDATE field_mappings
SET
  hubspot_property_type = 'number',
  mindbody_field_type = 'number'
WHERE entity_type = 'deal'
  AND hubspot_property = 'amount';

UPDATE field_mappings
SET
  hubspot_property_type = 'datetime',
  mindbody_field_type = 'datetime'
WHERE entity_type = 'deal'
  AND hubspot_property = 'closedate';

UPDATE field_mappings
SET
  hubspot_property_type = 'enumeration',
  mindbody_field_type = 'string'
WHERE entity_type = 'deal'
  AND hubspot_property = 'deal_source';
