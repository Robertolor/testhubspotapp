import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getSupabase } from "@/lib/db/client";
import { Card, CardTitle } from "@/components/ui/card";

function isWriteAction(
  message: string | null | undefined
): message is "created" | "updated" {
  return message === "created" || message === "updated";
}

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

  const { data: hubspot } = await getSupabase()
    .from("hubspot_accounts")
    .select("portal_id")
    .eq("tenant_id", session.tenantId)
    .maybeSingle();

  const portalId = hubspot?.portal_id
    ? String(hubspot.portal_id)
    : null;

  const writeEvents = (events ?? []).filter((ev) => isWriteAction(ev.message));
  const createdCount = writeEvents.filter((ev) => ev.message === "created").length;
  const updatedCount = writeEvents.filter((ev) => ev.message === "updated").length;

  function hubspotRecordPath(entityType: string): string {
    if (entityType === "line_item") return "0-8";
    if (entityType === "deal") return "0-3";
    return "0-1";
  }

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
          {writeEvents.length > 0 ? (
            <>
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="font-medium text-emerald-700">{createdCount}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Updated</dt>
                <dd className="font-medium text-sky-700">{updatedCount}</dd>
              </div>
            </>
          ) : null}
          <div>
            <dt className="text-slate-500">Started</dt>
            <dd className="font-medium">
              {new Date(run.started_at).toLocaleString()}
            </dd>
          </div>
        </dl>
        {writeEvents.length > 0 && createdCount === 0 && updatedCount > 0 ? (
          <p className="mt-3 text-sm text-sky-700">
            All synced records were updates — no new HubSpot records created.
          </p>
        ) : null}
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{ev.entity_type}</span>
                <span className="text-slate-400">·</span>
                <span>{ev.direction}</span>
                <span className="text-slate-400">·</span>
                <span>{ev.status}</span>
                {isWriteAction(ev.message) ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      ev.message === "created"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-sky-100 text-sky-800"
                    }`}
                  >
                    {ev.message}
                  </span>
                ) : ev.message ? (
                  <>
                    <span className="text-slate-400">—</span>
                    <span className="text-slate-600">{ev.message}</span>
                  </>
                ) : null}
              </div>
              {(ev.source_id || ev.target_id) && (
                <div className="mt-1 font-mono text-xs text-slate-500">
                  {ev.source_id ? <span>Mindbody: {ev.source_id}</span> : null}
                  {ev.source_id && ev.target_id ? " · " : null}
                  {ev.target_id ? (
                    <span>
                      HubSpot:{" "}
                      {portalId ? (
                        <a
                          className="text-teal-700 underline"
                          href={`https://app.hubspot.com/contacts/${portalId}/record/${hubspotRecordPath(ev.entity_type)}/${ev.target_id}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {ev.target_id}
                        </a>
                      ) : (
                        ev.target_id
                      )}
                    </span>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
