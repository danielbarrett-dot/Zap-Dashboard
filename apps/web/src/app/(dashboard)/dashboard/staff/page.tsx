"use client";

import useSWR from "swr";

import { LoadingBlock } from "@/components/loading-block";
import { Panel } from "@/components/panel";
import { apiFetcher } from "@/lib/api";
import { formatHours } from "@/lib/format";
import { useCurrentUser } from "@/lib/hooks";

type StaffResponse = {
  rows: Array<{
    staffName: string;
    labourHours: number;
    jobs: number;
  }>;
};

export default function StaffPage() {
  const { user } = useCurrentUser();
  const { data, isLoading } = useSWR<StaffResponse>(
    user && user.role !== "STAFF" ? "/dashboard/staff" : null,
    apiFetcher
  );

  if (!user || isLoading) {
    return <LoadingBlock label="Loading staff utilisation..." />;
  }

  if (user.role === "STAFF") {
    return (
      <Panel title="Staff performance" eyebrow="Restricted">
        <p className="text-sm text-slate-500">
          This page is limited to managers and admins because it aggregates team-wide performance.
        </p>
      </Panel>
    );
  }

  if (!data) {
    return <LoadingBlock label="Loading staff utilisation..." />;
  }

  return (
    <div className="space-y-6">
      <Panel title="Staff performance" eyebrow="Phase 2 foundation">
        <p className="mb-6 max-w-2xl text-sm text-slate-500">
          This phase gives management a clean view of hours and job involvement by engineer without exposing staff-only sensitive financial data.
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="pb-3 pr-4 font-semibold">Staff member</th>
                <th className="pb-3 pr-4 font-semibold">Hours</th>
                <th className="pb-3 pr-4 font-semibold">Jobs touched</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row) => (
                <tr key={row.staffName} className="text-sm text-slate-700">
                  <td className="py-4 pr-4 font-semibold text-ink">{row.staffName}</td>
                  <td className="py-4 pr-4">{formatHours(row.labourHours)}</td>
                  <td className="py-4 pr-4">{row.jobs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
