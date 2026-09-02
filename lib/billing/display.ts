import type Stripe from "stripe";
import { getStripe } from "./stripe";
import { getBillingSubscriptionRow } from "./subscription";
import { formatStripeAmount, unixToIso } from "./format";

export type BillingCard = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

export type BillingInvoiceRow = {
  id: string;
  date: string;
  amountLabel: string;
  status: string;
  description: string | null;
};

export type BillingDisplay = {
  hasCustomer: boolean;
  stripeStatus: string | null;
  cancelAtPeriodEnd: boolean;
  productName: string | null;
  priceLabel: string | null;
  chargeCurrency: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  card: BillingCard | null;
  customerName: string | null;
  customerEmail: string | null;
  customerCountry: string | null;
  invoices: BillingInvoiceRow[];
};

function emptyDisplay(
  extras: Partial<BillingDisplay> = {}
): BillingDisplay {
  return {
    hasCustomer: false,
    stripeStatus: null,
    cancelAtPeriodEnd: false,
    productName: null,
    priceLabel: null,
    chargeCurrency: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    card: null,
    customerName: null,
    customerEmail: null,
    customerCountry: null,
    invoices: [],
    ...extras,
  };
}

function productNameFromPrice(price: Stripe.Price | undefined): string | null {
  const product = price?.product;
  if (product && typeof product === "object" && "name" in product) {
    const name = product.name?.trim();
    return name || null;
  }
  return null;
}

function priceLabelFromPrice(price: Stripe.Price | undefined): string | null {
  if (!price || price.unit_amount == null || !price.currency) return null;
  const amount = formatStripeAmount(price.unit_amount, price.currency);
  const interval = price.recurring?.interval;
  if (interval === "year") return `${amount} per year`;
  if (interval === "month") return `${amount} per month`;
  if (interval) return `${amount} per ${interval}`;
  return amount;
}

function cardFromPaymentMethod(
  method: Stripe.PaymentMethod | string | null | undefined
): BillingCard | null {
  if (!method || typeof method === "string") return null;
  const card = method.card;
  if (!card?.last4) return null;
  return {
    brand: card.brand ?? "card",
    last4: card.last4,
    expMonth: card.exp_month,
    expYear: card.exp_year,
  };
}

function invoiceDescription(invoice: Stripe.Invoice): string | null {
  const line = invoice.lines?.data?.[0]?.description?.trim();
  if (line) return line;
  return invoice.description?.trim() || invoice.number || null;
}

async function resolveCard(
  stripe: Stripe,
  customerId: string,
  subscription: Stripe.Subscription | null
): Promise<BillingCard | null> {
  const fromSub = cardFromPaymentMethod(subscription?.default_payment_method);
  if (fromSub) return fromSub;

  const listed = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
    limit: 1,
  });
  return cardFromPaymentMethod(listed.data[0]);
}

export async function loadBillingDisplay(
  tenantId: string
): Promise<BillingDisplay> {
  const row = await getBillingSubscriptionRow(tenantId);
  if (!row?.stripe_customer_id) {
    return emptyDisplay();
  }

  const fallback = emptyDisplay({
    hasCustomer: true,
    stripeStatus: row.status,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    currentPeriodEnd: row.current_period_end,
    customerEmail: row.billing_email,
  });

  try {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(row.stripe_customer_id);
    if (customer.deleted) {
      return fallback;
    }

    let subscription: Stripe.Subscription | null = null;
    if (row.stripe_subscription_id) {
      subscription = await stripe.subscriptions.retrieve(
        row.stripe_subscription_id,
        { expand: ["default_payment_method", "items.data.price.product"] }
      );
    } else {
      const listed = await stripe.subscriptions.list({
        customer: row.stripe_customer_id,
        status: "all",
        limit: 1,
        expand: ["data.default_payment_method", "data.items.data.price.product"],
      });
      subscription = listed.data[0] ?? null;
    }

    const price = subscription?.items.data[0]?.price;
    const itemPeriodEnd = unixToIso(
      subscription?.items?.data?.[0]?.current_period_end
    );
    const rootPeriodEnd = unixToIso(
      (subscription as { current_period_end?: number } | null)?.current_period_end
    );
    const invoiceList = await stripe.invoices.list({
      customer: row.stripe_customer_id,
      limit: 8,
    });

    return {
      hasCustomer: true,
      stripeStatus: subscription?.status ?? row.status,
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
      productName: productNameFromPrice(price),
      priceLabel: priceLabelFromPrice(price),
      chargeCurrency: subscription?.currency
        ? subscription.currency.toUpperCase()
        : null,
      trialEndsAt: unixToIso(subscription?.trial_end) ?? null,
      currentPeriodEnd: itemPeriodEnd ?? rootPeriodEnd ?? row.current_period_end,
      card: await resolveCard(stripe, row.stripe_customer_id, subscription),
      customerName: customer.name?.trim() || null,
      customerEmail:
        customer.email?.trim() || row.billing_email?.trim() || null,
      customerCountry: customer.address?.country?.trim() || null,
      invoices: invoiceList.data.map((invoice) => {
        const amount =
          invoice.status === "paid" ? invoice.amount_paid : invoice.total;
        return {
          id: invoice.id,
          date: unixToIso(invoice.created) ?? new Date().toISOString(),
          amountLabel: formatStripeAmount(amount ?? 0, invoice.currency),
          status: invoice.status
            ? invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)
            : "Unknown",
          description: invoiceDescription(invoice),
        };
      }),
    };
  } catch (error) {
    console.error("Failed to load Stripe billing display:", error);
    return fallback;
  }
}
