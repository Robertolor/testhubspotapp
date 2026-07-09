export interface MindbodyLineItemFieldCatalogItem {
  key: string;
  label: string;
  type: string;
}

const LINE_ITEM_FIELDS: MindbodyLineItemFieldCatalogItem[] = [
  { key: "line_item_key", label: "Line item key", type: "string" },
  { key: "mindbody_sale_id", label: "Sale ID", type: "string" },
  { key: "sale_detail_id", label: "Sale detail ID", type: "string" },
  { key: "name", label: "Name", type: "string" },
  { key: "description", label: "Description", type: "string" },
  { key: "quantity", label: "Quantity", type: "number" },
  { key: "unit_price", label: "Unit price", type: "number" },
  { key: "line_total", label: "Line total", type: "number" },
  { key: "item_id", label: "Item ID", type: "string" },
  { key: "contract_id", label: "Contract ID", type: "string" },
  { key: "recipient_client_id", label: "Recipient client ID", type: "string" },
  { key: "is_service", label: "Is service", type: "boolean" },
  { key: "category_id", label: "Category ID", type: "string" },
  { key: "subcategory_id", label: "Subcategory ID", type: "string" },
  { key: "returned", label: "Returned", type: "boolean" },
];

export function listMindbodyLineItemFields(): MindbodyLineItemFieldCatalogItem[] {
  return [...LINE_ITEM_FIELDS];
}
