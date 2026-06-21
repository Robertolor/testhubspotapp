import { getSession } from "@/lib/auth/session";
import { FieldMappingsShell } from "@/components/field-mappings-shell";

export default async function FieldMappingsPage() {
  const session = await getSession();
  if (!session) return null;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-slate-900">Field mappings</h2>
      <p className="mt-1 text-slate-600">
        Configure how Mindbody data maps to HubSpot properties per object.
      </p>
      <p className="mt-1 font-mono text-xs text-slate-400">
        Tenant {session.tenantId}
      </p>
      <FieldMappingsShell tenantId={session.tenantId} />
    </div>
  );
}
