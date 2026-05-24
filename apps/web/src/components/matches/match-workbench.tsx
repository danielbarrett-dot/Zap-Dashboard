"use client";

import { useState } from "react";

import { StatusPill } from "@/components/status-pill";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { MatchRow, MatchesResponse, UserRole } from "@/types";

function MatchCard({ match, canConfirm, onRefresh }: { match: MatchRow; canConfirm: boolean; onRefresh: () => void }) {
  const [isSaving, setIsSaving] = useState(false);

  const confirm = async () => {
    setIsSaving(true);
    try {
      await apiFetch(`/matches/${match.id}/confirm`, { method: "POST" });
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-ink">
            {match.job.jobName} · Invoice #{match.invoice.invoiceNumber}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {match.invoice.reference || match.invoice.memo || "No invoice reference"}
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-slate-500">
            {formatDate(match.invoice.invoiceDate)} · {formatCurrency(match.invoice.totalExVat)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill value={match.status} />
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
            {match.matchType.replaceAll("_", " ")} · {Math.round((match.confidenceScore || 0) * 100)}%
          </p>
          {canConfirm && match.status === "POSSIBLE_MATCH" ? (
            <button
              onClick={confirm}
              disabled={isSaving}
              className="rounded-md bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-60"
            >
              {isSaving ? "Saving" : "Confirm"}
            </button>
          ) : null}
        </div>
      </div>
      {match.notes ? <p className="mt-3 text-sm text-slate-600">{match.notes}</p> : null}
    </div>
  );
}

export function MatchWorkbench({
  data,
  role,
  onRefresh
}: {
  data: MatchesResponse;
  role: UserRole;
  onRefresh: () => void;
}) {
  const [jobId, setJobId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const canOverride = role === "ADMIN";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!jobId || !invoiceId) {
      return;
    }

    setIsSaving(true);

    try {
      await apiFetch("/matches/manual", {
        method: "POST",
        body: JSON.stringify({
          jobId,
          invoiceId,
          notes
        })
      });

      setJobId("");
      setInvoiceId("");
      setNotes("");
      onRefresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Possible matches</p>
          <div className="mt-4 space-y-3">
            {data.possibleMatches.map((match) => (
              <MatchCard key={match.id} match={match} canConfirm={canOverride} onRefresh={onRefresh} />
            ))}
            {data.possibleMatches.length === 0 ? <p className="text-sm text-slate-500">No possible matches need review.</p> : null}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Confirmed matches</p>
          <div className="mt-4 space-y-3">
            {data.confirmedMatches.map((match) => (
              <MatchCard key={match.id} match={match} canConfirm={false} onRefresh={onRefresh} />
            ))}
          </div>
        </section>
      </div>

      <div className="space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Unmatched invoices</p>
          <div className="mt-4 max-h-96 space-y-3 overflow-auto">
            {data.unmatchedInvoices.map((invoice) => (
              <div key={invoice.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">#{invoice.invoiceNumber}</p>
                    <p className="mt-1 text-sm text-slate-500">{invoice.customerName}</p>
                  </div>
                  <span className="text-sm font-semibold text-ink">{formatCurrency(invoice.totalExVat)}</span>
                </div>
                <p className="mt-2 text-xs text-slate-500">{invoice.reference || invoice.memo || "No reference"}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Manual match</p>
          {canOverride ? (
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Job
                <select className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3" value={jobId} onChange={(event) => setJobId(event.target.value)}>
                  <option value="">Select a job</option>
                  {data.unmatchedJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.jobName} · {job.customerName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Invoice
                <select className="mt-2 w-full rounded-md border border-slate-200 bg-white px-4 py-3" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}>
                  <option value="">Select an invoice</option>
                  {data.unmatchedInvoices.map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      #{invoice.invoiceNumber} · {invoice.customerName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-slate-700">
                Notes
                <textarea className="mt-2 min-h-24 w-full rounded-md border border-slate-200 bg-white px-4 py-3" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
              <button type="submit" disabled={isSaving} className="rounded-md bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                {isSaving ? "Saving match" : "Save manual match"}
              </button>
            </form>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Only admins can create or confirm invoice matches.</p>
          )}
        </section>
      </div>
    </div>
  );
}
