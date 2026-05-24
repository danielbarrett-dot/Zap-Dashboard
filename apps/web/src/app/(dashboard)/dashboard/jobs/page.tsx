"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import { JobsTable } from "@/components/jobs/jobs-table";
import { LoadingBlock } from "@/components/loading-block";
import { Panel } from "@/components/panel";
import { apiFetch } from "@/lib/api";
import { useCurrentUser } from "@/lib/hooks";
import type { JobsResponse } from "@/types";

export default function JobsPage() {
  const { user } = useCurrentUser();
  const [filters, setFilters] = useState({
    from: "",
    to: "",
    leadSource: "",
    jobType: "",
    customer: "",
    jobStatus: "",
    matchStatus: "",
    missingMaterials: "",
    missingTime: ""
  });

  const query = useMemo(
    () => ({
      ...filters,
      page: 1,
      pageSize: 50
    }),
    [filters]
  );

  const { data, isLoading } = useSWR<JobsResponse>(
    ["/dashboard/jobs", query],
    ([path, builtQuery]: [string, typeof query]) => apiFetch<JobsResponse>(path, { query: builtQuery })
  );

  if (!user || isLoading || !data) {
    return <LoadingBlock label="Loading job profitability data..." />;
  }

  const leadSourceOptions = Array.from(
    new Set(data.items.map((item) => String(item.leadSource || "Unknown")).filter(Boolean))
  );
  const jobStatusOptions = Array.from(
    new Set(data.items.map((item) => String(item.status || "Unknown")).filter(Boolean))
  );
  const jobTypeOptions = Array.from(
    new Set(data.items.map((item) => String(item.jobType || "Other")).filter(Boolean))
  );
  const missingFilterValue = filters.missingMaterials ? "materials" : filters.missingTime ? "time" : "";

  return (
    <div className="space-y-6">
      <Panel title="Jobs table" eyebrow="Filterable performance view">
        <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-8">
          <label className="block text-sm font-medium text-slate-700">
            From
            <input
              type="date"
              value={filters.from}
              onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value }))}
              className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal transition focus:ring"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            To
            <input
              type="date"
              value={filters.to}
              onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value }))}
              className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal transition focus:ring"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Lead source
            <select
              value={filters.leadSource}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  leadSource: event.target.value === "All" ? "" : event.target.value
                }))
              }
              className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal transition focus:ring"
            >
              <option value="">All</option>
              {leadSourceOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Customer
            <input
              type="text"
              value={filters.customer}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  customer: event.target.value
                }))
              }
              className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal transition focus:ring"
            />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Job status
            <select
              value={filters.jobStatus}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  jobStatus: event.target.value === "All" ? "" : event.target.value
                }))
              }
              className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal transition focus:ring"
            >
              <option value="">All</option>
              {jobStatusOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Job type
            <select
              value={filters.jobType}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  jobType: event.target.value
                }))
              }
              className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal transition focus:ring"
            >
              <option value="">All</option>
              {jobTypeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Match status
            <select
              value={filters.matchStatus}
              onChange={(event) => setFilters((current) => ({ ...current, matchStatus: event.target.value }))}
              className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal transition focus:ring"
            >
              <option value="">All</option>
              <option value="MATCHED">Matched</option>
              <option value="MANUALLY_CONFIRMED">Manual</option>
              <option value="POSSIBLE_MATCH">Possible</option>
              <option value="UNMATCHED">Unmatched</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Missing data
            <select
              value={missingFilterValue}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  missingMaterials: event.target.value === "materials" ? "true" : "",
                  missingTime: event.target.value === "time" ? "true" : ""
                }))
              }
              className="mt-2 w-full rounded-md border border-slate-200 bg-slate-50 px-4 py-3 outline-none ring-teal transition focus:ring"
            >
              <option value="">All</option>
              <option value="materials">Missing materials</option>
              <option value="time">Missing time</option>
            </select>
          </label>
        </div>
      </Panel>

      <Panel title={`Showing ${data.total} jobs`} eyebrow="Matched revenue by job">
        <JobsTable items={data.items} role={user.role} />
      </Panel>
    </div>
  );
}
