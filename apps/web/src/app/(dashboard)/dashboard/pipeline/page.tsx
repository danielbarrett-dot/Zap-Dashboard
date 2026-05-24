"use client";

import useSWR from "swr";

import { LoadingBlock } from "@/components/loading-block";
import { Panel } from "@/components/panel";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { apiFetcher } from "@/lib/api";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import type { PipelineResponse } from "@/types";

export default function PipelinePage() {
  const { data, isLoading } = useSWR<PipelineResponse>("/dashboard/pipeline", apiFetcher);

  if (isLoading || !data) {
    return <LoadingBlock label="Loading pipeline visibility..." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Quoted jobs" value={String(data.quoted.count)} hint={`${formatCurrency(data.quoted.estimatedRevenue)} quoted`} accent="amber" />
        <StatCard label="Accepted jobs" value={String(data.accepted.count)} hint={`${formatCurrency(data.accepted.estimatedRevenue)} accepted`} accent="teal" />
        <StatCard label="Next 4 weeks" value={formatCurrency(data.next4Weeks.estimatedRevenue)} hint={`${formatHours(data.next4Weeks.estimatedLabourHours)} estimated`} accent="pine" />
        <StatCard label="Next 8 weeks" value={formatCurrency(data.next8Weeks.estimatedRevenue)} hint={`${formatHours(data.next8Weeks.estimatedLabourHours)} estimated`} accent="coral" />
      </div>

      <Panel title="Booked jobs in the next 8 weeks" eyebrow="Forward workload">
        <div className="space-y-3">
          {data.futureJobs.map((job) => (
            <div key={job.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink">{job.jobName}</p>
                  <p className="mt-1 text-sm text-slate-500">{job.customerName}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                    {formatDate(job.jobDate)} · {job.leadSource || "Unknown source"} · {job.jobType || "Other"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-3">
                  <StatusPill value={job.jobStatus} />
                  <p className="text-sm text-slate-500">
                    {formatCurrency(job.quotedValue)} · {formatHours(job.estimatedHours)}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {data.futureJobs.length === 0 ? <p className="text-sm text-slate-500">No accepted future jobs are currently scheduled.</p> : null}
        </div>
      </Panel>
    </div>
  );
}
