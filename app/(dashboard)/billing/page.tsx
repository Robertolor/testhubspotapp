import { getSession } from "@/lib/auth/session";
import {
  BillingCheckoutButtons,
  StripePortalButton,
} from "@/components/billing-actions";
import { Card, CardTitle } from "@/components/ui/card";
import { hasYearlyPrice, isBillingEnforcementEnabled } from "@/lib/billing/config";
import { loadBillingDisplay } from "@/lib/billing/display";
import { isStripeStatusEntitled } from "@/lib/billing/entitlement";
import {
  formatCardBrand,
  formatLongDate,
  formatShortDate,
  formatInvoiceDate,
} from "@/lib/billing/format";

function continuationCopy(display: {
  stripeStatus: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}): string | null {
  const status = display.stripeStatus;
  if (display.cancelAtPeriodEnd && display.currentPeriodEnd) {
    return `Your subscription is set to cancel on ${formatLongDate(display.currentPeriodEnd)}.`;
  }
  if (status === "trialing" && display.trialEndsAt) {
    return `After your free trial ends on ${formatLongDate(display.trialEndsAt)}, this service will continue automatically.`;
  }
  if (status === "active" && display.currentPeriodEnd) {
    return `Your next charge is on ${formatLongDate(display.currentPeriodEnd)}.`;
  }
  if (status === "past_due") {
    return "The last charge failed. Update your card to keep this subscription.";
  }
  if (status === "canceled") {
    return "This subscription is canceled.";
  }
  return null;
}

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const session = await getSession();
  if (!session) return null;

  const [{ checkout }, display] = await Promise.all([
    searchParams,
    loadBillingDisplay(session.tenantId),
  ]);

  const status = display.stripeStatus;
  const canStartTrial = !isStripeStatusEntitled(status);
  const canCancel =
    status === "trialing" || status === "active" || status === "past_due";
  const continuation = continuationCopy(display);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Billing</h2>
        <p className="mt-1 text-slate-600">
          This HubSpot portal is billed through Stripe.
        </p>
      </div>

      {checkout === "success" ? (
        <p className="rounded-md border border-brand-border bg-white px-4 py-3 text-sm text-brand-ink">
          Checkout is complete. Stripe may take a few seconds to show your trial
          here.
        </p>
      ) : null}
      {checkout === "canceled" ? (
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Checkout was canceled. You can start the trial when you are ready.
        </p>
      ) : null}

      <Card className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>Current subscription</CardTitle>
          {canCancel && !display.cancelAtPeriodEnd ? (
            <StripePortalButton flow="cancel">
              Cancel subscription
            </StripePortalButton>
          ) : null}
        </div>

        {status === "trialing" && display.trialEndsAt ? (
          <p className="inline-flex rounded-md bg-amber-100 px-2.5 py-1 text-sm font-medium text-amber-900">
            Free trial ends {formatShortDate(display.trialEndsAt)}
          </p>
        ) : null}

        {status ? (
          <div>
            <p className="text-lg font-semibold text-slate-900">
              {display.productName ?? "Subscription"}
            </p>
            {display.priceLabel ? (
              <p className="mt-1 text-slate-700">{display.priceLabel}</p>
            ) : null}
            {display.chargeCurrency ? (
              <p className="mt-1 text-sm text-slate-500">
                Charged in {display.chargeCurrency}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-700">
            You do not have a trial or subscription yet. A card is required.
            You will not be charged today. After 14 days Stripe charges the
            card unless you cancel or uninstall the app.
          </p>
        )}

        {continuation ? (
          <p className="text-sm text-slate-600">{continuation}</p>
        ) : null}

        {display.card ? (
          <p className="text-sm text-slate-600">
            {formatCardBrand(display.card.brand)} ending in {display.card.last4}
          </p>
        ) : null}

        <BillingCheckoutButtons
          canStartTrial={canStartTrial}
          showYearly={hasYearlyPrice()}
        />
      </Card>

      {display.hasCustomer ? (
        <>
          <Card className="space-y-3">
            <CardTitle>Payment method</CardTitle>
            {display.card ? (
              <p className="text-sm text-slate-700">
                {formatCardBrand(display.card.brand)} ending in {display.card.last4}
                {display.card.expMonth && display.card.expYear
                  ? `, expires ${String(display.card.expMonth).padStart(2, "0")}/${display.card.expYear}`
                  : null}
              </p>
            ) : (
              <p className="text-sm text-slate-600">No card on file yet.</p>
            )}
            <StripePortalButton flow="payment_method" variant="ghost">
              {display.card ? "Update payment method" : "Add payment method"}
            </StripePortalButton>
          </Card>

          <Card className="space-y-3">
            <CardTitle>Billing information</CardTitle>
            <dl className="space-y-1 text-sm text-slate-700">
              {display.customerName ? (
                <div>
                  <dt className="text-slate-500">Name</dt>
                  <dd>{display.customerName}</dd>
                </div>
              ) : null}
              {display.customerEmail ? (
                <div>
                  <dt className="text-slate-500">Email</dt>
                  <dd>{display.customerEmail}</dd>
                </div>
              ) : null}
              {display.customerCountry ? (
                <div>
                  <dt className="text-slate-500">Billing address</dt>
                  <dd>{display.customerCountry}</dd>
                </div>
              ) : null}
              {!display.customerName &&
              !display.customerEmail &&
              !display.customerCountry ? (
                <p className="text-slate-600">No billing details yet.</p>
              ) : null}
            </dl>
            <StripePortalButton flow="default" variant="ghost">
              Update information
            </StripePortalButton>
          </Card>

          <Card className="space-y-3">
            <CardTitle>Invoice history</CardTitle>
            {display.invoices.length === 0 ? (
              <p className="text-sm text-slate-600">No invoices yet.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {display.invoices.map((invoice) => (
                  <li
                    key={invoice.id}
                    className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
                  >
                    <span className="text-slate-700">
                      {formatInvoiceDate(invoice.date)}
                    </span>
                    <span className="font-medium text-slate-900">
                      {invoice.amountLabel}
                    </span>
                    <span className="text-slate-600">{invoice.status}</span>
                    {invoice.description ? (
                      <span className="w-full text-slate-500">
                        {invoice.description}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      ) : null}

      {!isBillingEnforcementEnabled() ? (
        <p className="text-xs text-slate-400">
          Sync gating is off in this environment.
        </p>
      ) : null}
    </div>
  );
}
