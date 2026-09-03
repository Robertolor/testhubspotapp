"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/action-feedback";

type PortalFlow = "default" | "cancel" | "payment_method";

export function StripePortalButton({
  flow,
  children,
  variant = "secondary",
  className,
}: {
  flow: PortalFlow;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flow }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Could not open billing");
      }
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open billing");
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      {error ? <ActionFeedback type="error">{error}</ActionFeedback> : null}
      <Button
        type="button"
        variant={variant}
        loading={pending}
        disabled={pending}
        className={className}
        onClick={openPortal}
      >
        {children}
      </Button>
    </span>
  );
}

export function BillingCheckoutButtons({
  canCheckout,
  includeTrial,
  showYearly,
}: {
  canCheckout: boolean;
  includeTrial: boolean;
  showYearly: boolean;
}) {
  const [pending, setPending] = useState<"monthly" | "yearly" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout(interval: "monthly" | "yearly") {
    setError(null);
    setPending(interval);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Could not start checkout");
      }
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout");
      setPending(null);
    }
  }

  if (!canCheckout) return null;

  return (
    <div className="space-y-3">
      {error ? <ActionFeedback type="error">{error}</ActionFeedback> : null}
      <div className="flex flex-wrap gap-3">
        <Button
          loading={pending === "monthly"}
          disabled={pending !== null}
          onClick={() => startCheckout("monthly")}
        >
          {includeTrial ? "Start 14-day trial" : "Subscribe"}
        </Button>
        {showYearly ? (
          <Button
            variant="secondary"
            loading={pending === "yearly"}
            disabled={pending !== null}
            onClick={() => startCheckout("yearly")}
          >
            Yearly plan
          </Button>
        ) : null}
      </div>
    </div>
  );
}
