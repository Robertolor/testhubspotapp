import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { BillingBanner } from "@/components/billing-banner";
import { DashboardNav } from "@/components/dashboard-nav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-teal-700">
              Mindbody ↔ HubSpot
            </p>
            <h1 className="text-lg font-semibold text-slate-900">
              Sync
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            HubSpot {session.portalId}
          </p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 px-6 py-8">
        <DashboardNav />
        <div className="mt-8">
          <BillingBanner tenantId={session.tenantId} />
          {children}
        </div>
      </main>
    </div>
  );
}
