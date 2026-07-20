/**
 * Extract HubSpot line item payloads from Mindbody ClientPurchases rows
 * (aligned with Gritcity normalize/purchases.py).
 */

function strId(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function saleIdFromPurchaseRow(row: Record<string, unknown>): string {
  const sale = row.Sale;
  if (!sale || typeof sale !== "object") return "";
  const saleObj = sale as Record<string, unknown>;
  return strId(saleObj.Id ?? saleObj.SaleId);
}

export function extractLineItemsForSale(
  purchaseRows: Record<string, unknown>[],
  saleId: string
): Record<string, unknown>[] {
  const items: Record<string, unknown>[] = [];
  let fallbackIndex = 0;

  for (const row of purchaseRows) {
    if (saleIdFromPurchaseRow(row) !== saleId) continue;

    const sale = row.Sale;
    if (!sale || typeof sale !== "object") continue;
    const purchasedItems = (sale as Record<string, unknown>).PurchasedItems;
    if (!Array.isArray(purchasedItems)) continue;

    for (const rawItem of purchasedItems) {
      if (!rawItem || typeof rawItem !== "object") continue;
      const item = rawItem as Record<string, unknown>;

      const itemName = String(item.Description ?? item.Name ?? "Item");
      const quantity = Number(item.Quantity ?? 1);
      const lineTotal = Number(item.TotalAmount ?? item.Amount ?? 0);
      const unitPrice =
        quantity > 0 ? lineTotal / quantity : lineTotal;
      const saleDetailId = strId(item.SaleDetailId);
      const lineItemKey = saleDetailId
        ? `${saleId}:${saleDetailId}`
        : `${saleId}:item:${fallbackIndex++}`;

      items.push({
        line_item_key: lineItemKey,
        mindbody_sale_id: saleId,
        sale_detail_id: saleDetailId || null,
        item_id: strId(item.Id ?? item.ItemId) || null,
        name: itemName,
        description: item.Notes != null ? String(item.Notes) : null,
        quantity,
        unit_price: unitPrice,
        line_total: lineTotal,
        contract_id: strId(item.ContractId) || null,
        recipient_client_id: strId(item.RecipientClientId) || null,
        is_service: item.IsService ?? null,
        category_id: strId(item.CategoryId) || null,
        subcategory_id: strId(item.SubcategoryId) || null,
        returned: item.Returned ?? null,
      });
    }
  }

  return items;
}
