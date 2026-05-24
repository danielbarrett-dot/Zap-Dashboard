import Link from "next/link";

import { StatusPill } from "@/components/status-pill";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import type { JobMetric, UserRole } from "@/types";

export function JobsTable({ items, role }: { items: JobMetric[]; role: UserRole }) {
  const canSeeFinancials = role !== "STAFF";

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200 text-left">
        <thead>
          <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
            <th className="pb-3 pr-4 font-semibold">Job</th>
            <th className="pb-3 pr-4 font-semibold">Status</th>
            <th className="pb-3 pr-4 font-semibold">Dates</th>
            <th className="pb-3 pr-4 font-semibold">Type</th>
            {canSeeFinancials ? <th className="pb-3 pr-4 font-semibold">Revenue ex VAT</th> : null}
            {canSeeFinancials ? <th className="pb-3 pr-4 font-semibold">Materials</th> : null}
            <th className="pb-3 pr-4 font-semibold">Labour</th>
            {canSeeFinancials ? <th className="pb-3 pr-4 font-semibold">GP before labour</th> : null}
            {canSeeFinancials ? <th className="pb-3 pr-4 font-semibold">GP after labour</th> : null}
            {canSeeFinancials ? <th className="pb-3 pr-4 font-semibold">Profit / hour</th> : null}
            <th className="pb-3 font-semibold">Warnings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item) => (
            <tr key={item.id} className="align-top text-sm text-slate-700">
              <td className="py-4 pr-4">
                <Link href={`/dashboard/jobs/${item.id}`} className="font-semibold text-ink hover:text-teal">
                  {item.jobName}
                </Link>
                <div className="mt-1 text-xs text-slate-500">{item.customerName}</div>
                {item.jobNumber ? <div className="mt-1 text-xs text-slate-500">{item.jobNumber}</div> : null}
              </td>
              <td className="py-4 pr-4">
                <StatusPill value={item.status || "Unknown"} />
                {item.invoiceMatchStatus ? <div className="mt-2"><StatusPill value={item.invoiceMatchStatus} /></div> : null}
              </td>
              <td className="py-4 pr-4">
                <div>{formatDate(item.completionDate)}</div>
                <div className="mt-1 text-xs text-slate-500">Job {formatDate(item.jobDate)}</div>
              </td>
              <td className="py-4 pr-4">
                <div>{item.jobType || "Other"}</div>
                <div className="mt-1 text-xs text-slate-500">{item.leadSource || "Unknown source"}</div>
              </td>
              {canSeeFinancials ? <td className="py-4 pr-4">{formatCurrency(item.revenueExVat)}</td> : null}
              {canSeeFinancials ? (
                <td className="py-4 pr-4">
                  {formatCurrency(item.materials)}
                  <div className="mt-1 text-xs text-slate-500">{item.materialCostSource?.replaceAll("_", " ")}</div>
                </td>
              ) : null}
              <td className="py-4 pr-4">{formatHours(item.labourHours)}</td>
              {canSeeFinancials ? <td className="py-4 pr-4">{formatCurrency(item.grossProfitBeforeLabour)}</td> : null}
              {canSeeFinancials ? <td className="py-4 pr-4">{formatCurrency(item.grossProfitAfterLabour)}</td> : null}
              {canSeeFinancials ? <td className="py-4 pr-4">{formatCurrency(item.grossProfitBeforeLabourPerHour)}</td> : null}
              <td className="py-4">
                <div className="flex max-w-sm flex-wrap gap-2">
                  {item.warnings.slice(0, 3).map((warning) => (
                    <span key={warning} className="rounded-md bg-coral/10 px-2 py-1 text-xs font-medium text-coral">
                      {warning}
                    </span>
                  ))}
                  {item.warnings.length === 0 ? (
                    <span className="rounded-md bg-pine/10 px-2 py-1 text-xs font-medium text-pine">Complete</span>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
