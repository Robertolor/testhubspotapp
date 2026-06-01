import { getSession } from "@/lib/auth/session";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-900">Settings</h2>
      <p className="mt-1 text-slate-600">
        Manage Mindbody credentials and sync direction per entity.
      </p>
      <div className="mt-6">
        <SettingsForm tenantId={session.tenantId} />
      </div>
    </div>
  );
}
