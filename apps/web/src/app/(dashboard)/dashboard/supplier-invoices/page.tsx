"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

import { LoadingBlock } from "@/components/loading-block";
import { Panel } from "@/components/panel";
import { StatusPill } from "@/components/status-pill";
import { apiFetch, apiFetcher } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCurrentUser } from "@/lib/hooks";
import type { JobsResponse, SupplierInvoiceRow, SupplierInvoicesResponse } from "@/types";

const tabs = [
  ["needs_review", "Needs Review"],
  ["new_unassigned", "New / Unassigned"],
  ["assigned", "Assigned"],
  ["partially_assigned", "Partially Assigned"],
  ["manually_corrected", "Manually Corrected"],
  ["ignored", "Ignored"],
  ["removed", "Removed"],
  ["failed", "Failed"],
  ["possible_duplicates", "Possible Duplicates"]
] as const;

function WarningBadges({ invoice }: { invoice: SupplierInvoiceRow }) {
  const warnings = invoice.warnings.length > 0 ? invoice.warnings : invoice.isDuplicateSuspected ? ["Possible duplicate"] : [];

  return (
    <div className="flex flex-wrap gap-2">
      {warnings.slice(0, 4).map((warning) => (
        <span key={warning} className="rounded-md bg-coral/10 px-2 py-1 text-xs font-medium text-coral">
          {warning}
        </span>
      ))}
      {invoice.isIncludedInJobCosting ? (
        <span className="rounded-md bg-pine/10 px-2 py-1 text-xs font-medium text-pine">Included in costing</span>
      ) : (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">Not in costing</span>
      )}
    </div>
  );
}

export default function SupplierInvoicesPage() {
  const { user } = useCurrentUser();
  const [tab, setTab] = useState("needs_review");
  const [selected, setSelected] = useState<SupplierInvoiceRow | null>(null);
  const [jobId, setJobId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const { data, isLoading, mutate } = useSWR<SupplierInvoicesResponse>(`/supplier-invoices?tab=${tab}`, apiFetcher);
  const { data: jobs } = useSWR<JobsResponse>(user?.role === "ADMIN" ? "/dashboard/jobs?pageSize=100" : null, apiFetcher);

  const selectedNet = selected?.netAmount || 0;
  const allocationAmount = useMemo(() => amount || String(selectedNet || ""), [amount, selectedNet]);

  if (!user || isLoading || !data) {
    return <LoadingBlock label="Loading supplier invoice inbox..." />;
  }

  const canEdit = user.role === "ADMIN";

  const allocate = async () => {
    if (!selected || !jobId) return;

    await apiFetch(`/supplier-invoices/${selected.id}/allocate`, {
      method: "POST",
      body: JSON.stringify({
        allocations: [
          {
            jobId,
            amountExVat: Number(allocationAmount),
            allocationType: Number(allocationAmount) === selected.netAmount ? "FULL_INVOICE" : "PARTIAL_AMOUNT",
            notes
          }
        ],
        notes,
        replaceExisting: true
      })
    });
    setSelected(null);
    setJobId("");
    setAmount("");
    setNotes("");
    await mutate();
  };

  const updateStatus = async (invoice: SupplierInvoiceRow, status: string) => {
    await apiFetch(`/supplier-invoices/${invoice.id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, reason: notes || undefined })
    });
    await mutate();
  };

  return (
    <div className="space-y-6">
      <Panel title="Supplier invoices" eyebrow="Default view: Needs Review">
        <div className="flex flex-wrap gap-2">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === value ? "bg-ink text-white" : "bg-slate-100 text-slate-700"}`}
            >
              {label} ({data.counts[value] || 0})
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Inbox" eyebrow="Review and allocation queue">
          <div className="space-y-3">
            {data.invoices.map((invoice) => (
              <button
                key={invoice.id}
                onClick={() => {
                  setSelected(invoice);
                  setAmount(invoice.netAmount ? String(invoice.netAmount) : "");
                }}
                className="block w-full rounded-lg border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-teal"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-ink">
                      {invoice.supplierName || "Unknown supplier"} · #{invoice.invoiceNumber || "No invoice number"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Received {formatDate(invoice.sourceEmailReceivedAt)} · Invoice date {formatDate(invoice.invoiceDate)}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{invoice.reference || invoice.sourceEmailSubject || "No reference"}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-ink">{formatCurrency(invoice.netAmount)} ex VAT</p>
                    <p className="mt-1 text-sm text-slate-500">VAT {formatCurrency(invoice.vatAmount)} · Gross {formatCurrency(invoice.grossAmount)}</p>
                    <div className="mt-2"><StatusPill value={invoice.extractionStatus} /></div>
                  </div>
                </div>
                <div className="mt-4"><WarningBadges invoice={invoice} /></div>
              </button>
            ))}
            {data.invoices.length === 0 ? <p className="text-sm text-slate-500">No supplier invoices in this tab.</p> : null}
          </div>
        </Panel>

        <Panel title="Manual review" eyebrow={canEdit ? "Admin actions" : "Read only"}>
          {selected ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-ink">{selected.supplierName || "Unknown supplier"}</p>
                <p className="mt-1 text-sm text-slate-500">#{selected.invoiceNumber || "No invoice number"} · {formatCurrency(selected.netAmount)} ex VAT</p>
                <div className="mt-3"><WarningBadges invoice={selected} /></div>
              </div>

              {canEdit ? (
                <>
                  <label className="block text-sm font-medium text-slate-700">
                    Allocate to job
                    <select value={jobId} onChange={(event) => setJobId(event.target.value)} className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3">
                      <option value="">Select a ServiceM8 job</option>
                      {jobs?.items.map((job) => (
                        <option key={job.id} value={job.id}>
                          {job.jobName} · {job.customerName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Amount ex VAT
                    <input value={allocationAmount} onChange={(event) => setAmount(event.target.value)} type="number" step="0.01" className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3" />
                  </label>
                  <label className="block text-sm font-medium text-slate-700">
                    Notes
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-4 py-3" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={allocate} className="rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white">Allocate</button>
                    <button onClick={() => updateStatus(selected, "IGNORED")} className="rounded-md bg-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">Ignore</button>
                    <button onClick={() => updateStatus(selected, "REMOVED")} className="rounded-md bg-coral/10 px-4 py-3 text-sm font-semibold text-coral">Remove from costing</button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-500">Only admins can amend allocations or invoice status.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select an invoice to review extraction, matching confidence, and allocations.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
