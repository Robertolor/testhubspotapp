import Link from "next/link";
import { getTenantEntitlement } from "@/lib/billing/entitlement";
import { isBillingEnforcementEnabled } from "@/lib/billing/config";

export async function BillingBanner({ tenantId }: { tenantId: string }) {
  if (!isBillingEnforcementEnabled()) return null;

  const entitlement = await getTenantEntitlement(tenantId);
  if (!entitlement) return null;

  if (entitlement.reason === "trial") {
    const ends = entitlement.snapshot.trialEndsAt
      ? new Date(entitlement.snapshot.trialEndsAt).toLocaleDateString()
      : "the end of your trial";
    return (
      <div className="mb-6 rounded-md border border-brand-border bg-white px-4 py-3 text-sm text-brand-ink">
        Trial until {ends}. After that your card is charged unless you cancel
        or uninstall.{" "}
        <Link href="/billing" className="font-medium underline">
          Billing
        </Link>
      </div>
    );
  }

  if (entitlement.reason === "subscription_past_due") {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Payment failed. Update your card to keep syncing.{" "}
        <Link href="/billing" className="font-medium underline">
          Billing
        </Link>
      </div>
    );
  }

  if (!entitlement.entitled) {
    return (
      <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Billing is not set up yet. Start a trial to sync.{" "}
        <Link href="/billing" className="font-medium underline">
          Go to Billing
        </Link>
      </div>
    );
  }

  return null;
}
