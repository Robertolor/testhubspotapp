import { getSession } from "@/lib/auth/session";
import { ReportsTable } from "@/components/reports-table";

export default async function ReportsPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-900">Sync reports</h2>
      <p className="mt-1 text-slate-600">
        Review sync runs and errors for your account.
      </p>
      <div className="mt-6">
        <ReportsTable tenantId={session.tenantId} />
      </div>
    </div>
  );
}
