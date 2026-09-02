export function formatStripeAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export function formatCardBrand(brand: string): string {
  const trimmed = brand.trim();
  if (!trimmed) return "Card";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatLongDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatInvoiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function unixToIso(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null;
  return new Date(value * 1000).toISOString();
}
