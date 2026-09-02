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
      <div className="mb-6 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
        Trial active until {ends}. Your card will be charged unless you cancel
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
        A trial or subscription is required to sync. Card required; you are
        charged after 14 days unless you cancel or uninstall.{" "}
        <Link href="/billing" className="font-medium underline">
          Start trial
        </Link>
      </div>
    );
  }

  return null;
}
