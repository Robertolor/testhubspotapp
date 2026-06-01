import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/client";
import { Card, CardTitle } from "@/components/ui/card";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/");

  const { runId } = await params;

  const { data: run, error } = await getSupabase()
    .from("sync_runs")
    .select("*")
    .eq("id", runId)
    .eq("tenant_id", session.tenantId)
    .single();

  if (error || !run) notFound();

  const { data: events } = await getSupabase()
    .from("sync_events")
    .select("*")
    .eq("sync_run_id", runId)
    .order("created_at", { ascending: true });

  return (
    <div className="space-y-6">
      <Link href="/reports" className="text-sm text-teal-700 hover:underline">
        ← Back to reports
      </Link>
      <h2 className="text-2xl font-semibold text-slate-900">Sync run details</h2>

      <Card>
        <CardTitle>Run summary</CardTitle>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium">{run.status}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Trigger</dt>
            <dd className="font-medium">{run.trigger_source}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Processed</dt>
            <dd className="font-medium">{run.records_processed}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Failed</dt>
            <dd className="font-medium">{run.records_failed}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Started</dt>
            <dd className="font-medium">
              {new Date(run.started_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <CardTitle>Events</CardTitle>
        <ul className="mt-4 space-y-2 text-sm">
          {(events ?? []).length === 0 && (
            <li className="text-slate-500">No events for this run.</li>
          )}
          {(events ?? []).map((ev) => (
            <li
              key={ev.id}
              className="rounded border border-slate-100 px-3 py-2"
            >
              <span className="font-medium">{ev.entity_type}</span>
              {" · "}
              {ev.direction} · {ev.status}
              {ev.message ? ` — ${ev.message}` : ""}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
