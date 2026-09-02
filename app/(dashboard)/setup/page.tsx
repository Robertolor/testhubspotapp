import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/client";
import { getTenantEntitlement } from "@/lib/billing/entitlement";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function SetupPage() {
  const session = await getSession();
  if (!session) return null;

  const [{ data: mindbody }, { data: settings }, entitlement] = await Promise.all([
    getSupabase()
      .from("mindbody_accounts")
      .select("site_id")
      .eq("tenant_id", session.tenantId)
      .maybeSingle(),
    getSupabase()
      .from("sync_settings")
      .select("contacts_enabled, deals_enabled")
      .eq("tenant_id", session.tenantId)
      .single(),
    getTenantEntitlement(session.tenantId),
  ]);

  const steps = [
    {
      done: true,
      title: "Connect HubSpot",
      detail: "OAuth completed for your portal.",
    },
    {
      done: !!mindbody,
      title: "Add Mindbody credentials",
      detail: "Site ID, API key, and staff login from your Mindbody business.",
    },
    {
      done: settings?.contacts_enabled || settings?.deals_enabled,
      title: "Enable sync",
      detail: "Turn on contacts and/or deals in settings.",
    },
    {
      done: Boolean(
        entitlement &&
          (entitlement.reason === "trial" ||
            entitlement.reason === "subscription_active" ||
            entitlement.reason === "subscription_past_due")
      ),
      title: "Start billing trial",
      detail:
        "Add a card to start 14 days free. After that Stripe charges the card unless you cancel or uninstall.",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Setup</h2>
        <p className="mt-1 text-slate-600">
          Complete these steps to start syncing data between Mindbody and
          HubSpot.
        </p>
      </div>

      <div className="space-y-3">
        {steps.map((step, i) => (
          <Card key={step.title} className="flex gap-4">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${step.done ? "bg-brand-accent text-white" : "bg-brand-border text-brand-ink"}`}
            >
              {step.done ? "✓" : i + 1}
            </div>
            <div>
              <CardTitle>{step.title}</CardTitle>
              <p className="mt-1 text-sm text-slate-600">{step.detail}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/settings">
          <Button>
            {mindbody ? "Review settings" : "Configure Mindbody"}
          </Button>
        </Link>
        <Link href="/billing">
          <Button variant="secondary">Billing</Button>
        </Link>
      </div>
    </div>
  );
}
