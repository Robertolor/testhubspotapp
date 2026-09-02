import Stripe from "stripe";
import { getSupabase } from "@/lib/db/client";
import { getStripe } from "./stripe";
import {
  findTenantIdForStripeSubscription,
  upsertBillingFromSubscription,
} from "./subscription";

const HANDLED_TYPES = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export function isHandledStripeEvent(type: string): boolean {
  return HANDLED_TYPES.has(type);
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  if (!isHandledStripeEvent(event.type)) return;

  const inserted = await claimStripeEvent(event);
  if (!inserted) return;

  try {
    await processStripeEvent(event);
  } catch (error) {
    await getSupabase().from("stripe_events").delete().eq("id", event.id);
    throw error;
  }
}

async function claimStripeEvent(event: Stripe.Event): Promise<boolean> {
  const { error } = await getSupabase().from("stripe_events").insert({
    id: event.id,
    type: event.type,
  });
  if (error?.code === "23505") return false;
  if (error) throw error;
  return true;
}

async function processStripeEvent(event: Stripe.Event): Promise<void> {
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleCheckoutCompleted(session);
    return;
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const tenantId = await findTenantIdForStripeSubscription(subscription);
    if (!tenantId) {
      console.warn("Stripe subscription event missing tenant mapping", {
        type: event.type,
        subscriptionId: subscription.id,
      });
      return;
    }
    await upsertBillingFromSubscription({ tenantId, subscription });
    return;
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = subscriptionIdFromInvoice(invoice);
    if (!subscriptionId) return;
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    const tenantId = await findTenantIdForStripeSubscription(subscription);
    if (!tenantId) return;
    await upsertBillingFromSubscription({
      tenantId,
      subscription,
      billingEmail: invoice.customer_email,
    });
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const tenantId =
    session.client_reference_id || session.metadata?.tenant_id || null;
  if (!tenantId) {
    console.warn("Checkout session missing tenant_id", session.id);
    return;
  }
  if (session.mode !== "subscription") return;

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;
  if (!subscriptionId) return;

  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  await upsertBillingFromSubscription({
    tenantId,
    subscription,
    billingEmail: session.customer_details?.email ?? session.customer_email,
  });
}

function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const parentSub = invoice.parent?.subscription_details?.subscription;
  if (typeof parentSub === "string") return parentSub;
  if (parentSub && typeof parentSub === "object" && "id" in parentSub) {
    return parentSub.id;
  }
  const legacy = (invoice as { subscription?: string | { id: string } | null })
    .subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object") return legacy.id;
  return null;
}
