"use client";

import { useEffect, useState } from "react";
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

export function BillingPeriodEndButtons({
  canCancel,
  cancelAtPeriodEnd,
  accessUntil,
}: {
  canCancel: boolean;
  cancelAtPeriodEnd: boolean;
  accessUntil?: string | null;
}) {
  const [pending, setPending] = useState<"cancel_at_period_end" | "resume" | null>(
    null
  );
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!confirming) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setConfirming(false);
      setError(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirming]);

  async function updateSubscription(action: "cancel_at_period_end" | "resume") {
    setError(null);
    setPending(action);
    try {
      const res = await fetch("/api/billing/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? "Could not update billing");
      }
      window.location.assign("/billing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update billing");
      setPending(null);
    }
  }

  if (!canCancel) return null;

  if (cancelAtPeriodEnd) {
    return (
      <span className="inline-flex flex-col items-end gap-2">
        {error ? <ActionFeedback type="error">{error}</ActionFeedback> : null}
        <Button
          type="button"
          variant="secondary"
          loading={pending === "resume"}
          disabled={pending !== null}
          onClick={() => updateSubscription("resume")}
        >
          Keep my subscription
        </Button>
      </span>
    );
  }

  if (confirming) {
    return (
      <div
        role="dialog"
        aria-labelledby="cancel-subscription-title"
        aria-describedby="cancel-subscription-copy"
        className="w-full max-w-sm rounded-md border border-brand-border bg-brand-paper p-4 text-left"
      >
        <p
          id="cancel-subscription-title"
          className="text-sm font-semibold text-brand-ink"
        >
          Cancel this subscription?
        </p>
        <p
          id="cancel-subscription-copy"
          className="mt-1 text-sm text-slate-600"
        >
          You will keep access until{" "}
          {accessUntil ?? "the end of this trial or paid period"}. You will not
          be charged after that. You can undo this on Billing before then.
        </p>
        {error ? (
          <div className="mt-2">
            <ActionFeedback type="error">{error}</ActionFeedback>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            disabled={pending !== null}
            onClick={() => {
              setConfirming(false);
              setError(null);
            }}
          >
            Never mind
          </Button>
          <Button
            type="button"
            loading={pending === "cancel_at_period_end"}
            disabled={pending !== null}
            onClick={() => updateSubscription("cancel_at_period_end")}
          >
            Yes, cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-2">
      {error ? <ActionFeedback type="error">{error}</ActionFeedback> : null}
      <Button
        type="button"
        variant="secondary"
        disabled={pending !== null}
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
      >
        Cancel subscription
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
