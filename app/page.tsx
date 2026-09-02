import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;

  if (session) {
    redirect(params.redirect || "/setup");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-brand-paper px-6 py-16">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-brand-clay">
          HubSpot Marketplace
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-brand-ink">
          Mindbody Sync
        </h1>
        <p className="mt-4 text-lg text-brand-muted">
          Sync contacts and deals between Mindbody and HubSpot. Install via
          OAuth, add your Mindbody API credentials, and configure sync direction
          per client.
        </p>

        {params.error && (
          <p className="mt-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            Installation error: {params.error}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <a href="/api/oauth/hubspot">
            <Button className="min-w-[200px]">Install with HubSpot</Button>
          </a>
        </div>

        <ul className="mt-10 space-y-2 text-left text-sm text-brand-muted">
          <li>OAuth install from HubSpot</li>
          <li>Mindbody Site ID, API key, and staff login per portal</li>
          <li>Webhooks from HubSpot and Mindbody</li>
          <li>Sync direction for contacts and deals</li>
        </ul>
      </div>
    </div>
  );
}
