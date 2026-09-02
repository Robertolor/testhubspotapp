import { getSession } from "@/lib/auth/session";
import { BillingActions } from "@/components/billing-actions";
import { Card, CardTitle } from "@/components/ui/card";
import { hasYearlyPrice } from "@/lib/billing/config";
import { getTenantEntitlement, isStripeStatusEntitled } from "@/lib/billing/entitlement";
import { getBillingSubscriptionRow } from "@/lib/billing/subscription";

function statusLabel(reason: string, stripeStatus: string | null): string {
  if (reason === "enforcement_off") {
    return "Billing enforcement is off (staging). Sync is not gated.";
  }
  if (reason === "trial") return "14-day trial in progress (card on file).";
  if (reason === "subscription_active") return "Subscription active.";
  if (reason === "subscription_past_due") {
    return "Payment past due. Stripe is retrying the card.";
  }
  if (stripeStatus) return `Subscription ${stripeStatus}. Sync is paused.`;
  return "No trial or subscription yet.";
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const [{ checkout }, entitlement, row] = await Promise.all([
    searchParams,
    getTenantEntitlement(session.tenantId),
    getBillingSubscriptionRow(session.tenantId),
  ]);

  const reason = entitlement?.reason ?? "no_subscription";
  const stripeStatus = entitlement?.snapshot.subscriptionStatus ?? row?.status ?? null;
  const trialEnd = entitlement?.snapshot.trialEndsAt;
  const canStartTrial = !isStripeStatusEntitled(stripeStatus);
  const canManage = Boolean(row?.stripe_customer_id);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Billing</h2>
        <p className="mt-1 text-slate-600">
          One subscription per HubSpot portal. Card is required to start the
          14-day trial. Stripe charges automatically when the trial ends unless
          you cancel or uninstall the app.
        </p>
      </div>

      {checkout === "success" ? (
        <p className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900">
          Checkout complete. If this page still says you have no subscription,
          wait a few seconds for Stripe to confirm.
        </p>
      ) : null}
      {checkout === "canceled" ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Checkout canceled. You can start the trial again when ready.
        </p>
      ) : null}

      <Card className="space-y-4">
        <CardTitle>Current plan</CardTitle>
        <p className="text-sm text-slate-700">{statusLabel(reason, stripeStatus)}</p>
        {trialEnd && reason === "trial" ? (
          <p className="text-sm text-slate-600">
            Trial ends {new Date(trialEnd).toLocaleString()}.
          </p>
        ) : null}
        {row?.current_period_end && reason === "subscription_active" ? (
          <p className="text-sm text-slate-600">
            Current period ends{" "}
            {new Date(row.current_period_end).toLocaleDateString()}.
          </p>
        ) : null}
        <BillingActions
          canStartTrial={canStartTrial}
          canManage={canManage}
          showYearly={hasYearlyPrice()}
        />
      </Card>
    </div>
  );
}
