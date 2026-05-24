"use client";

import { ArrowLeft, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

import { LoadingBlock } from "@/components/loading-block";
import { Panel } from "@/components/panel";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { apiFetch, apiFetcher } from "@/lib/api";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import { useCurrentUser } from "@/lib/hooks";
import type { JobDetailResponse } from "@/types";

export default function JobDetailPage() {
  const params = useParams<{ jobId: string }>();
  const { user } = useCurrentUser();
  const { data, isLoading, mutate } = useSWR<JobDetailResponse>(`/dashboard/jobs/${params.jobId}`, apiFetcher);
  const [overrideValue, setOverrideValue] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  if (!user || isLoading || !data) {
    return <LoadingBlock label="Loading job detail..." />;
  }

  const job = data.job;
  const canSeeFinancials = user.role !== "STAFF";
  const canOverride = user.role === "ADMIN";

  const saveMaterialOverride = async () => {
    await apiFetch(`/dashboard/jobs/${job.id}/override`, {
      method: "PATCH",
      body: JSON.stringify({
        fieldName: "manualMaterialOverride",
        value: overrideValue === "" ? null : Number(overrideValue),
        reason: overrideReason || undefined
      })
    });
    setOverrideValue("");
    setOverrideReason("");
    await mutate();
  };

  return (
    <div className="space-y-6">
      <Link href="/dashboard/jobs" className="inline-flex items-center gap-2 text-sm font-semibold text-teal">
        <ArrowLeft className="h-4 w-4" />
        Back to jobs
      </Link>

      <Panel
        title={job.jobName}
        eyebrow={`${job.jobNumber || "No job number"} · ${job.customerName}`}
        actions={<StatusPill value={job.dataConfidence} />}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</p>
            <p className="mt-2 font-semibold text-ink">{job.status}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Completion date</p>
            <p className="mt-2 font-semibold text-ink">{formatDate(job.completionDate)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Lead source</p>
            <p className="mt-2 font-semibold text-ink">{job.leadSource || "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Job type</p>
            <p className="mt-2 font-semibold text-ink">{job.jobType || "Other"}</p>
          </div>
        </div>
      </Panel>

      {canSeeFinancials ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Revenue ex VAT" value={formatCurrency(job.revenueExVat)} hint="Confirmed QuickBooks invoices" />
          <StatCard label="Materials" value={formatCurrency(job.materials)} hint={job.materialCostSource?.replaceAll("_", " ")} accent="amber" />
          <StatCard label="GP before labour" value={formatCurrency(job.grossProfitBeforeLabour)} accent="pine" />
          <StatCard label="GP after labour" value={formatCurrency(job.grossProfitAfterLabour)} hint="Restricted when rates are missing" accent="coral" />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Warnings" eyebrow="Data confidence">
          <div className="space-y-2">
            {job.warnings.map((warning) => (
              <div key={warning} className="flex items-start gap-2 rounded-lg border border-coral/20 bg-coral/5 p-3 text-sm text-coral">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{warning}</span>
              </div>
            ))}
            {job.warnings.length === 0 ? <p className="text-sm text-slate-500">No current warnings for this job.</p> : null}
          </div>
        </Panel>

        <Panel title="Timing and estimates" eyebrow="Quoted vs actual">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Labour hours" value={formatHours(job.labourHours)} hint={`Estimated ${formatHours(job.estimatedHours)}`} />
            <StatCard label="Revenue / hour" value={formatCurrency(job.revenuePerLabourHour)} accent="teal" />
            <StatCard label="Materials variance" value={formatCurrency(job.estimatedVsActualMaterials)} hint="Actual minus estimate" accent="amber" />
          </div>
        </Panel>
      </div>

      {canSeeFinancials ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Matched QuickBooks invoices" eyebrow="Revenue source">
            <div className="space-y-3">
              {(job.matchedInvoices || []).map((match) => {
                const invoice = match.invoice as Record<string, unknown>;
                return (
                  <div key={String(match.id)} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-ink">Invoice #{String(invoice.invoiceNumber)}</p>
                        <p className="mt-1 text-sm text-slate-500">{String(invoice.reference || "No reference")}</p>
                      </div>
                      <p className="font-semibold text-ink">{formatCurrency(Number(invoice.totalExVat || 0))}</p>
                    </div>
                  </div>
                );
              })}
              {(job.matchedInvoices || []).length === 0 ? <p className="text-sm text-slate-500">No confirmed invoices are matched.</p> : null}
            </div>
          </Panel>

          <Panel title="Supplier invoice allocations" eyebrow="Material source">
            <div className="space-y-3">
              {(job.supplierInvoices || []).map((invoice) => (
                <div key={String(invoice.id)} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-ink">{String(invoice.supplierName || "Unknown supplier")}</p>
                      <p className="mt-1 text-sm text-slate-500">#{String(invoice.invoiceNumber || "No invoice number")} · {String(invoice.allocationType)}</p>
                    </div>
                    <p className="font-semibold text-ink">{formatCurrency(Number(invoice.amountExVat || 0))}</p>
                  </div>
                </div>
              ))}
              {(job.supplierInvoices || []).length === 0 ? <p className="text-sm text-slate-500">No supplier invoices are allocated.</p> : null}
            </div>
          </Panel>
        </div>
      ) : null}

      {canOverride ? (
        <Panel title="Admin overrides" eyebrow="Audit logged">
          <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <label className="block text-sm font-medium text-slate-700">
              Manual material override ex VAT
              <input
                value={overrideValue}
                onChange={(event) => setOverrideValue(event.target.value)}
                type="number"
                step="0.01"
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3"
                placeholder={job.materials === undefined ? "" : String(job.materials)}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Reason
              <input
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3"
                placeholder="Why the override is needed"
              />
            </label>
            <button onClick={saveMaterialOverride} className="self-end rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white">
              Save override
            </button>
          </div>
        </Panel>
      ) : null}

      {canSeeFinancials ? (
        <Panel title="Audit trail" eyebrow="Recent changes">
          <div className="space-y-3">
            {data.auditLogs.map((log) => (
              <div key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-semibold text-ink">{log.action}</p>
                <p className="mt-1 text-slate-500">{formatDate(log.createdAt)} {log.reason ? `· ${log.reason}` : ""}</p>
              </div>
            ))}
            {data.auditLogs.length === 0 ? <p className="text-sm text-slate-500">No audit entries for this job yet.</p> : null}
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
