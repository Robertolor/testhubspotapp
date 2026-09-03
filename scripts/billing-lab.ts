/**
 * Automated Stripe + DB billing checks in test mode.
 * Does not install or uninstall HubSpot. Prints portal ids and statuses only.
 *
 *   npx tsx scripts/billing-lab.ts
 *   npx tsx scripts/billing-lab.ts --run
 *
 * --run mutates portal 46455144 only, then runs isolated test-clock proofs.
 * Never touches portal 244359900.
 */
import fs from "node:fs";
import path from "node:path";
import {
  evaluateEntitlement,
  isStripeStatusEntitled,
} from "../lib/billing/entitlement";
import { getStripe } from "../lib/billing/stripe";
import { getBillingTrialDays } from "../lib/billing/config";
import {
  resumeStripeIfScheduled,
  setCancelAtPeriodEnd,
} from "../lib/billing/lifecycle";
import { cancelStripeForPortal } from "../lib/billing/uninstall";
import {
  getBillingSubscriptionRow,
  upsertBillingFromSubscription,
} from "../lib/billing/subscription";
import { getSupabase } from "../lib/db/client";
import { shouldIncludeCheckoutTrial } from "../lib/billing/checkout";

const LAB_PORTAL = 46455144;
const PROTECTED_PORTAL = 244359900;
const DAY = 86_400;

function loadEnvLocal(): void {
  const file = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`  PASS  ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type PortalRow = {
  portal_id: number;
  tenant_id: string;
  hub_domain: string | null;
};

async function listPortals(): Promise<
  Array<
    PortalRow & {
      tenantStatus: string;
      stripeStatus: string | null;
      entitled: boolean;
      reason: string;
      cancelAtPeriodEnd: boolean;
    }
  >
> {
  const supabase = getSupabase();
  const { data: accounts, error } = await supabase
    .from("hubspot_accounts")
    .select("portal_id, tenant_id, hub_domain");
  if (error) throw error;

  const rows = [];
  for (const account of (accounts ?? []) as PortalRow[]) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("status")
      .eq("id", account.tenant_id)
      .maybeSingle();
    const billing = await getBillingSubscriptionRow(account.tenant_id);
    const result = evaluateEntitlement({
      subscriptionStatus: billing?.status ?? null,
      enforcement: true,
    });
    rows.push({
      ...account,
      tenantStatus: (tenant?.status as string) ?? "unknown",
      stripeStatus: billing?.status ?? null,
      entitled: result.entitled,
      reason: result.reason,
      cancelAtPeriodEnd: Boolean(billing?.cancel_at_period_end),
    });
  }
  return rows;
}

async function attachVisa(customerId: string): Promise<string> {
  const stripe = getStripe();
  const method = await stripe.paymentMethods.create({
    type: "card",
    card: { token: "tok_visa" },
  });
  await stripe.paymentMethods.attach(method.id, { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: method.id },
  });
  return method.id;
}

async function attachDecliningCard(
  customerId: string,
  subscriptionId: string
): Promise<string> {
  const stripe = getStripe();
  const method = await stripe.paymentMethods.create({
    type: "card",
    card: { token: "tok_chargeCustomerFail" },
  });
  await stripe.paymentMethods.attach(method.id, { customer: customerId });
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: method.id },
  });
  await stripe.subscriptions.update(subscriptionId, {
    default_payment_method: method.id,
  });
  return method.id;
}

async function hardCancelTenantSubscription(tenantId: string): Promise<void> {
  const stripe = getStripe();
  const existing = await getBillingSubscriptionRow(tenantId);
  if (!existing?.stripe_subscription_id) return;
  if (existing.status === "canceled") return;
  const subscription = await stripe.subscriptions.cancel(
    existing.stripe_subscription_id
  );
  await upsertBillingFromSubscription({ tenantId, subscription });
}

async function createTrialSubscription(tenantId: string, portalId: number) {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID_MONTHLY?.trim();
  if (!priceId) throw new Error("STRIPE_PRICE_ID_MONTHLY is not set");

  await hardCancelTenantSubscription(tenantId);
  const existing = await getBillingSubscriptionRow(tenantId);
  const customerId =
    existing?.stripe_customer_id ??
    (
      await stripe.customers.create({
        email: `billing-lab-${portalId}@example.com`,
        metadata: {
          tenant_id: tenantId,
          portal_id: String(portalId),
          lab: "billing-lab",
        },
      })
    ).id;

  await attachVisa(customerId);

  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    trial_period_days: getBillingTrialDays(),
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: {
      tenant_id: tenantId,
      portal_id: String(portalId),
      lab: "billing-lab",
    },
  });

  await upsertBillingFromSubscription({
    tenantId,
    subscription,
    billingEmail: `billing-lab-${portalId}@example.com`,
  });
  return subscription;
}

async function refreshEntitlement(tenantId: string) {
  const row = await getBillingSubscriptionRow(tenantId);
  return {
    ...evaluateEntitlement({
      subscriptionStatus: row?.status ?? null,
      enforcement: true,
    }),
    cancelAtPeriodEnd: Boolean(row?.cancel_at_period_end),
    status: row?.status ?? null,
  };
}

async function waitForClock(clockId: string, label: string) {
  const stripe = getStripe();
  for (let i = 0; i < 90; i++) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === "ready") return clock;
    await sleep(2000);
  }
  throw new Error(`test clock did not become ready after ${label}`);
}

async function waitForSubscriptionStatus(
  subscriptionId: string,
  wanted: string[],
  label: string
) {
  const stripe = getStripe();
  for (let i = 0; i < 45; i++) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ["latest_invoice"],
    });
    if (wanted.includes(subscription.status)) return subscription;
    await sleep(2000);
  }
  const last = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice"],
  });
  throw new Error(`${label}: wanted ${wanted.join("|")}, got ${last.status}`);
}

async function runGraceLab(portalId: number): Promise<void> {
  assert(portalId !== PROTECTED_PORTAL, "lab must not use the live trial portal");
  const portals = await listPortals();
  const target = portals.find((row) => row.portal_id === portalId);
  assert(target, `portal ${portalId} exists in the database`);

  console.log("\n1. Clear leftover entitlement on the lab portal");
  if (target.entitled) {
    await hardCancelTenantSubscription(target.tenant_id);
  }
  const before = await refreshEntitlement(target.tenant_id);
  assert(!before.entitled, `portal ${portalId} is not entitled before trial`);

  console.log("\n2. Start a 14-day trial via Stripe API");
  const trial = await createTrialSubscription(target.tenant_id, portalId);
  assert(trial.status === "trialing", "Stripe subscription status is trialing");
  const duringTrial = await refreshEntitlement(target.tenant_id);
  assert(duringTrial.entitled, "trial entitles sync");
  assert(duringTrial.reason === "trial", "entitlement reason is trial");
  assert(
    shouldIncludeCheckoutTrial("trialing") === false,
    "already trialing does not get a second trial"
  );

  console.log("\n3. HubSpot uninstall helper schedules period-end cancel");
  const cancelResult = await cancelStripeForPortal(portalId);
  assert(cancelResult.canceled, "uninstall helper scheduled Stripe cancel");
  const afterUninstall = await refreshEntitlement(target.tenant_id);
  assert(afterUninstall.entitled, "uninstall grace still entitles until period end");
  assert(afterUninstall.cancelAtPeriodEnd, "cancel_at_period_end is set");
  assert(afterUninstall.status === "trialing", "status stays trialing");

  console.log("\n4. Reinstall path clears the scheduled cancel");
  const resumed = await resumeStripeIfScheduled(target.tenant_id);
  assert(resumed.resumed, "reinstall resumed the subscription");
  const afterResume = await refreshEntitlement(target.tenant_id);
  assert(afterResume.entitled, "resumed trial is still entitled");
  assert(!afterResume.cancelAtPeriodEnd, "cancel_at_period_end is cleared");

  console.log("\n5. In-app cancel keeps access until period end");
  const canceled = await setCancelAtPeriodEnd({
    tenantId: target.tenant_id,
    cancel: true,
  });
  assert(canceled?.cancel_at_period_end, "in-app cancel sets cancel_at_period_end");
  const afterInApp = await refreshEntitlement(target.tenant_id);
  assert(afterInApp.entitled, "in-app cancel still entitles until period end");
  const undone = await setCancelAtPeriodEnd({
    tenantId: target.tenant_id,
    cancel: false,
  });
  assert(undone && !undone.cancel_at_period_end, "Keep my subscription clears the flag");

  console.log("\n6. Lab cleanup (immediate cancel, not the product path)");
  await hardCancelTenantSubscription(target.tenant_id);
  const afterCleanup = await refreshEntitlement(target.tenant_id);
  assert(!afterCleanup.entitled, "lab portal is not left with a live trial");
  assert(
    shouldIncludeCheckoutTrial("canceled") === false,
    "canceled customer does not get a second trial"
  );
}

async function runClockProofs(): Promise<void> {
  const stripe = getStripe();
  const priceId = process.env.STRIPE_PRICE_ID_MONTHLY?.trim();
  if (!priceId) throw new Error("STRIPE_PRICE_ID_MONTHLY is not set");
  const trialDays = getBillingTrialDays();

  console.log("\n7. Test clock: trial ends and the card is charged");
  const clock = await stripe.testHelpers.testClocks.create({
    frozen_time: Math.floor(Date.now() / 1000),
    name: "billing-lab-day-14",
  });
  await waitForClock(clock.id, "create");

  try {
    const customer = await stripe.customers.create({
      email: `clock-lab-${clock.id}@example.com`,
      test_clock: clock.id,
      metadata: { lab: "billing-lab-clock" },
    });
    await attachVisa(customer.id);
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_period_days: trialDays,
      payment_settings: { save_default_payment_method: "on_subscription" },
      metadata: { lab: "billing-lab-clock" },
    });
    assert(subscription.status === "trialing", "clock subscription starts trialing");

    const ready = await stripe.testHelpers.testClocks.retrieve(clock.id);
    await stripe.testHelpers.testClocks.advance(clock.id, {
      frozen_time: ready.frozen_time + (trialDays + 1) * DAY,
    });
    await waitForClock(clock.id, "advance past trial");
    const charged = await waitForSubscriptionStatus(
      subscription.id,
      ["active", "past_due"],
      "day-14 charge"
    );
    assert(charged.status === "active", "after trial the subscription is active");
    const invoice = charged.latest_invoice;
    if (invoice && typeof invoice !== "string") {
      assert(
        invoice.status === "paid" || (invoice.amount_paid ?? 0) > 0,
        "trial-end invoice was paid"
      );
    }
    assert(
      evaluateEntitlement({
        subscriptionStatus: charged.status,
        enforcement: true,
      }).entitled,
      "active after trial is entitled"
    );

    console.log("\n8. Test clock: declining card becomes past_due and stays entitled");
    await attachDecliningCard(customer.id, subscription.id);
    const afterCharge = await stripe.testHelpers.testClocks.retrieve(clock.id);
    await stripe.testHelpers.testClocks.advance(clock.id, {
      frozen_time: afterCharge.frozen_time + 32 * DAY,
    });
    await waitForClock(clock.id, "advance to renewal");
    const pastDue = await waitForSubscriptionStatus(
      subscription.id,
      ["past_due", "unpaid", "canceled"],
      "renewal with declining card"
    );
    assert(pastDue.status === "past_due", "failed renewal is past_due");
    const pastDueEntitlement = evaluateEntitlement({
      subscriptionStatus: pastDue.status,
      enforcement: true,
    });
    assert(pastDueEntitlement.entitled, "past_due stays entitled during dunning");
    assert(
      pastDueEntitlement.reason === "subscription_past_due",
      "entitlement reason is subscription_past_due"
    );
  } finally {
    await stripe.testHelpers.testClocks.del(clock.id);
  }
}

async function main(): Promise<void> {
  loadEnvLocal();
  process.env.BILLING_ENFORCEMENT = "true";

  const run = process.argv.includes("--run");
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  assert(key.startsWith("sk_test_"), "Stripe key is test mode");

  console.log("Inventory (enforcement treated as on):");
  const portals = await listPortals();
  for (const row of portals) {
    console.log(
      `  portal ${row.portal_id}  tenant=${row.tenant_id.slice(0, 8)}…  stripe=${row.stripeStatus ?? "none"}  cancel_at_period_end=${row.cancelAtPeriodEnd}  entitled=${row.entitled}  ${row.reason}`
    );
  }

  const grit = portals.find((row) => row.portal_id === PROTECTED_PORTAL);
  if (grit) {
    console.log(
      `  note: portal ${PROTECTED_PORTAL} is listed only; --run will not mutate it`
    );
  }

  const unit = evaluateEntitlement({
    subscriptionStatus: null,
    enforcement: true,
  });
  assert(!unit.entitled && unit.reason === "no_subscription", "null status is no_subscription");
  assert(
    evaluateEntitlement({ subscriptionStatus: "past_due", enforcement: true })
      .entitled,
    "past_due is still entitled"
  );
  assert(
    evaluateEntitlement({ subscriptionStatus: "trialing", enforcement: true })
      .entitled,
    "trialing with cancel_at_period_end would still entitle"
  );

  if (!run) {
    console.log(
      "\nRead-only done. Re-run with --run for grace, in-app cancel, test clock, and past_due on portal",
      LAB_PORTAL
    );
    return;
  }

  await runGraceLab(LAB_PORTAL);
  await runClockProofs();
  console.log("\nLab finished. Portal", LAB_PORTAL, "ends canceled. Clock customers deleted.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
