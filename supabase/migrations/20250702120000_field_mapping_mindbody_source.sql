-- Deal mappings: distinguish Mindbody sale vs contract field sources
ALTER TABLE field_mappings
  ADD COLUMN IF NOT EXISTS mindbody_source TEXT;

ALTER TABLE field_mappings
  DROP CONSTRAINT IF EXISTS field_mappings_mindbody_source_check;

ALTER TABLE field_mappings
  ADD CONSTRAINT field_mappings_mindbody_source_check
  CHECK (mindbody_source IS NULL OR mindbody_source IN ('sale', 'contract'));

UPDATE field_mappings
SET mindbody_source = 'contract'
WHERE entity_type = 'deal'
  AND mindbody_field IN (
    'contractName',
    'contractStartDateTime',
    'contractEndDateTime',
    'clientContractId',
    'clientUniqueId',
    'agreementDate',
    'autopayStatus',
    'locationId'
  );

UPDATE field_mappings
SET mindbody_source = 'sale'
WHERE entity_type = 'deal'
  AND mindbody_field IN (
    'saleId',
    'totalAmount',
    'paymentsTotal',
    'clientId',
    'amount',
    'saleDateTime',
    'originalSaleDateTime'
  );

UPDATE field_mappings
SET mindbody_source = 'contract'
WHERE entity_type = 'deal'
  AND hubspot_property = 'deal_source'
  AND mindbody_source IS NULL;

UPDATE field_mappings
SET mindbody_source = 'contract'
WHERE entity_type = 'deal'
  AND hubspot_property = 'mindbody_contract_id'
  AND mindbody_source IS NULL;

UPDATE field_mappings
SET mindbody_source = 'sale'
WHERE entity_type = 'deal'
  AND hubspot_property = 'mindbody_sale_id'
  AND mindbody_source IS NULL;
