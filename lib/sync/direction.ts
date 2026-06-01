import type { SyncDirection, SyncSource, WebhookSource } from "@/lib/db/types";

export function allowsSync(
  direction: SyncDirection,
  from: SyncSource | WebhookSource,
  to: "hubspot" | "mindbody"
): boolean {
  const source =
    from === "hubspot" ? "hubspot" : from === "mindbody" ? "mindbody" : from;

  if (direction === "bidirectional") return true;
  if (direction === "mb_to_hs" && source === "mindbody" && to === "hubspot")
    return true;
  if (direction === "hs_to_mb" && source === "hubspot" && to === "mindbody")
    return true;
  return false;
}
