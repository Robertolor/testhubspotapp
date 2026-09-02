"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ActionFeedback } from "@/components/ui/action-feedback";

export function BillingActions({
  canStartTrial,
  canManage,
  showYearly,
}: {
  canStartTrial: boolean;
  canManage: boolean;
  showYearly: boolean;
}) {
  const [pending, setPending] = useState<"monthly" | "yearly" | "portal" | null>(
    null
  );
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

  async function openPortal() {
    setError(null);
    setPending("portal");
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) {
        throw new Error(json.error ?? "Could not open billing portal");
      }
      window.location.href = json.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open billing portal");
      setPending(null);
    }
  }

  return (
    <div className="space-y-3">
      {error ? <ActionFeedback type="error">{error}</ActionFeedback> : null}
      <div className="flex flex-wrap gap-3">
        {canStartTrial ? (
          <>
            <Button
              loading={pending === "monthly"}
              disabled={pending !== null}
              onClick={() => startCheckout("monthly")}
            >
              Start 14-day trial
            </Button>
            {showYearly ? (
              <Button
                variant="secondary"
                loading={pending === "yearly"}
                disabled={pending !== null}
                onClick={() => startCheckout("yearly")}
              >
                Yearly trial
              </Button>
            ) : null}
          </>
        ) : null}
        {canManage ? (
          <Button
            variant={canStartTrial ? "secondary" : "primary"}
            loading={pending === "portal"}
            disabled={pending !== null}
            onClick={openPortal}
          >
            Manage billing
          </Button>
        ) : null}
      </div>
    </div>
  );
}
