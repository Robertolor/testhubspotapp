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
    <div className="flex min-h-0 flex-1 flex-col bg-brand-paper">
      <header className="bg-brand-ink text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">
              Marketplace app
            </p>
            <h1 className="text-base font-semibold">Mindbody Sync</h1>
          </div>
          <p className="text-sm text-white/75">
            Portal {session.portalId}
          </p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-6 py-6">
        <DashboardNav />
        <div className="mt-6 min-w-0">
          <BillingBanner tenantId={session.tenantId} />
          {children}
        </div>
      </main>
    </div>
  );
}
