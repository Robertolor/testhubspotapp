"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardTitle } from "@/components/ui/card";

interface SyncRun {
  id: string;
  status: string;
  entity_type: string | null;
  trigger_source: string;
  records_processed: number;
  records_failed: number;
  started_at: string;
  completed_at: string | null;
}

interface SyncError {
  id: string;
  message: string;
  entity_type: string | null;
  external_id: string | null;
  created_at: string;
}

export function ReportsTable({ tenantId }: { tenantId: string }) {
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [errors, setErrors] = useState<SyncError[]>([]);

  useEffect(() => {
    fetch(`/api/tenants/${tenantId}/sync-runs`)
      .then((r) => r.json())
      .then((d) => {
        setRuns(d.runs ?? []);
        setErrors(d.errors ?? []);
      });
  }, [tenantId]);

  return (
    <div className="space-y-6">
      <Card>
        <CardTitle>Recent sync runs</CardTitle>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="pb-2 pr-4">Started</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4">Processed</th>
                <th className="pb-2 pr-4">Failed</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-slate-500">
                    No sync runs yet.
                  </td>
                </tr>
              )}
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-slate-100">
                  <td className="py-3 pr-4">
                    {new Date(run.started_at).toLocaleString()}
                  </td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={run.status} />
                  </td>
                  <td className="py-3 pr-4">{run.trigger_source}</td>
                  <td className="py-3 pr-4">{run.records_processed}</td>
                  <td className="py-3 pr-4">{run.records_failed}</td>
                  <td className="py-3">
                    <Link
                      href={`/reports/${run.id}`}
                      className="text-hs-link hover:underline"
                    >
                      Details
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle>Recent errors</CardTitle>
        <ul className="mt-4 space-y-3">
          {errors.length === 0 && (
            <li className="text-sm text-slate-500">No errors recorded.</li>
          )}
          {errors.map((err) => (
            <li
              key={err.id}
              className="rounded-lg border border-red-100 bg-red-50/50 px-4 py-3 text-sm"
            >
              <p className="font-medium text-red-900">{err.message}</p>
              <p className="mt-1 text-xs text-red-700">
                {err.entity_type && `${err.entity_type} · `}
                {err.external_id && `ID ${err.external_id} · `}
                {new Date(err.created_at).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    partial: "bg-amber-100 text-amber-800",
    running: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] ?? "bg-slate-100 text-slate-700"}`}
    >
      {status}
    </span>
  );
}
