import Link from "next/link";
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
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-teal-50 px-6">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-teal-700">
          HubSpot Marketplace App
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
          Mindbody ↔ HubSpot Sync
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Sync contacts and deals between Mindbody and HubSpot. Install via
          OAuth, add your Mindbody API credentials, and configure sync direction
          per client.
        </p>

        {params.error && (
          <p className="mt-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            Installation error: {params.error}
          </p>
        )}

        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link href="/api/oauth/hubspot">
            <Button className="min-w-[200px]">Install with HubSpot</Button>
          </Link>
        </div>

        <ul className="mt-10 space-y-2 text-left text-sm text-slate-600">
          <li>• OAuth 2.0 HubSpot installation</li>
          <li>• Per-tenant Mindbody Site ID + API key</li>
          <li>• Webhooks from HubSpot and Mindbody</li>
          <li>• Configurable sync direction for contacts and deals</li>
        </ul>

        <p className="mt-12 text-sm text-slate-500">
          <Link href="/privacy" className="text-teal-700 hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
