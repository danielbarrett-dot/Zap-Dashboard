"use client";

import useSWR from "swr";

import { LeadSourceBarChart } from "@/components/charts/lead-source-bar-chart";
import { LoadingBlock } from "@/components/loading-block";
import { Panel } from "@/components/panel";
import { formatCurrency, formatHours } from "@/lib/format";
import { apiFetcher } from "@/lib/api";
import { useCurrentUser } from "@/lib/hooks";
import type { MarketingResponse } from "@/types";

export default function MarketingPage() {
  const { user } = useCurrentUser();
  const { data, isLoading } = useSWR<MarketingResponse>("/dashboard/marketing", apiFetcher);

  if (!user || isLoading || !data) {
    return <LoadingBlock label="Loading lead source performance..." />;
  }

  return (
    <div className="space-y-6">
      <Panel title="Revenue by source" eyebrow="Lead source performance">
        <LeadSourceBarChart
          data={data.rows.map((row) => ({
            leadSource: row.leadSource,
            revenue: row.revenue
          }))}
        />
      </Panel>

      <Panel title="Source breakdown" eyebrow="What is driving the right work">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="pb-3 pr-4 font-semibold">Lead source</th>
                <th className="pb-3 pr-4 font-semibold">Jobs</th>
                <th className="pb-3 pr-4 font-semibold">Revenue</th>
                {user.role !== "STAFF" ? <th className="pb-3 pr-4 font-semibold">GP before labour</th> : null}
                <th className="pb-3 pr-4 font-semibold">Labour</th>
                <th className="pb-3 pr-4 font-semibold">Avg job value</th>
                {user.role !== "STAFF" ? <th className="pb-3 font-semibold">Profit / Hour</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.rows.map((row) => (
                <tr key={row.leadSource} className="text-sm text-slate-700">
                  <td className="py-4 pr-4 font-semibold text-ink">{row.leadSource}</td>
                  <td className="py-4 pr-4">{row.jobs}</td>
                  <td className="py-4 pr-4">{formatCurrency(row.revenue)}</td>
                  {user.role !== "STAFF" ? (
                    <td className="py-4 pr-4">{formatCurrency(row.grossProfitBeforeLabour)}</td>
                  ) : null}
                  <td className="py-4 pr-4">{formatHours(row.labourHours)}</td>
                  <td className="py-4 pr-4">{formatCurrency(row.avgJobValue)}</td>
                  {user.role !== "STAFF" ? (
                    <td className="py-4">{formatCurrency(row.profitPerHour)}</td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
