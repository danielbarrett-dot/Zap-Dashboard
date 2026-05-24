"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";

import { LoadingBlock } from "@/components/loading-block";
import { Panel } from "@/components/panel";
import { apiFetcher } from "@/lib/api";
import { formatCurrency, formatHours } from "@/lib/format";
import { useCurrentUser } from "@/lib/hooks";
import type { JobTypesResponse } from "@/types";

export default function JobTypesPage() {
  const { user } = useCurrentUser();
  const { data, isLoading } = useSWR<JobTypesResponse>("/dashboard/job-types", apiFetcher);

  if (!user || isLoading || !data) {
    return <LoadingBlock label="Loading job type reporting..." />;
  }

  return (
    <div className="space-y-6">
      <Panel title="Revenue by job type" eyebrow="Work mix">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#d6e2e7" />
              <XAxis dataKey="jobType" stroke="#64748b" />
              <YAxis stroke="#64748b" />
              <Tooltip formatter={(value: number) => [formatCurrency(value), "Revenue"]} />
              <Bar dataKey="revenue" fill="#12747c" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Job type profitability" eyebrow="Pricing and timing assumptions">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="pb-3 pr-4 font-semibold">Job type</th>
                <th className="pb-3 pr-4 font-semibold">Jobs</th>
                <th className="pb-3 pr-4 font-semibold">Revenue</th>
                {user.role !== "STAFF" ? <th className="pb-3 pr-4 font-semibold">Profit</th> : null}
                {user.role !== "STAFF" ? <th className="pb-3 pr-4 font-semibold">Profit / hour</th> : null}
                <th className="pb-3 pr-4 font-semibold">Labour</th>
                <th className="pb-3 pr-4 font-semibold">Hours variance</th>
                {user.role !== "STAFF" ? <th className="pb-3 font-semibold">Materials variance</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row) => (
                <tr key={row.jobType} className="text-sm text-slate-700">
                  <td className="py-4 pr-4 font-semibold text-ink">{row.jobType}</td>
                  <td className="py-4 pr-4">{row.jobs}</td>
                  <td className="py-4 pr-4">{formatCurrency(row.revenue)}</td>
                  {user.role !== "STAFF" ? <td className="py-4 pr-4">{formatCurrency(row.profit)}</td> : null}
                  {user.role !== "STAFF" ? <td className="py-4 pr-4">{formatCurrency(row.profitPerHour)}</td> : null}
                  <td className="py-4 pr-4">{formatHours(row.labourHours)}</td>
                  <td className="py-4 pr-4">{formatHours(row.estimatedHoursVsActual)}</td>
                  {user.role !== "STAFF" ? <td className="py-4">{formatCurrency(row.estimatedMaterialsVsActual)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
