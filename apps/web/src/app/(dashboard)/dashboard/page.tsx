"use client";

import { Activity, AlertTriangle, Briefcase, Clock, FileWarning, PoundSterling, ReceiptText, TrendingUp, Wrench } from "lucide-react";
import useSWR from "swr";

import { LeadSourceBarChart } from "@/components/charts/lead-source-bar-chart";
import { OverviewTrendChart } from "@/components/charts/overview-trend-chart";
import { LoadingBlock } from "@/components/loading-block";
import { Panel } from "@/components/panel";
import { StatCard } from "@/components/stat-card";
import { StatusPill } from "@/components/status-pill";
import { apiFetcher } from "@/lib/api";
import { formatCurrency, formatHours } from "@/lib/format";
import { useCurrentUser } from "@/lib/hooks";
import type { OverviewResponse } from "@/types";

export default function OverviewPage() {
  const { user } = useCurrentUser();
  const { data, isLoading } = useSWR<OverviewResponse>("/dashboard/overview", apiFetcher);

  if (!user || isLoading || !data) {
    return <LoadingBlock label="Loading the overview dashboard..." />;
  }

  const restrictedProfit = user.role === "STAFF";
  const formatCount = (value: number | null) => (value === null ? "Restricted" : String(value));
  const summaryCards = [
    {
      label: "Revenue this month",
      value: formatCurrency(data.summary.revenueThisMonth),
      hint: "Completed-job view using ex VAT matched invoices",
      accent: "teal" as const,
      icon: <PoundSterling className="h-5 w-5" />
    },
    {
      label: "Gross profit before labour",
      value: formatCurrency(data.summary.grossProfitBeforeLabour),
      hint: restrictedProfit ? "Restricted for staff roles" : "Revenue less approved materials and subcontractors",
      accent: "amber" as const,
      icon: <TrendingUp className="h-5 w-5" />
    },
    {
      label: "Gross profit after labour",
      value: formatCurrency(data.summary.grossProfitAfterLabour),
      hint: "Only shown where labour rates are available",
      accent: "pine" as const,
      icon: <Activity className="h-5 w-5" />
    },
    {
      label: "P&L net profit",
      value: formatCurrency(data.summary.pnlNetProfitThisMonth),
      hint: "QuickBooks revenue and expenses by transaction date",
      accent: "coral" as const,
      icon: <ReceiptText className="h-5 w-5" />
    },
    {
      label: "Profit per labour hour",
      value: data.summary.profitPerLabourHour === null ? "Restricted" : formatCurrency(data.summary.profitPerLabourHour),
      hint: `${formatHours(data.summary.labourHours)} across ${data.summary.completedJobs} completed jobs`,
      accent: "teal" as const,
      icon: <Wrench className="h-5 w-5" />
    },
    {
      label: "Average job value",
      value: formatCurrency(data.summary.averageJobValue),
      hint: restrictedProfit ? "Revenue only" : `Avg profit/job ${formatCurrency(data.summary.averageProfitPerJob)}`,
      accent: "amber" as const,
      icon: <Briefcase className="h-5 w-5" />
    },
    {
      label: "Booked next 4 weeks",
      value: formatCurrency(data.summary.bookedWorkNext4Weeks),
      hint: `${formatCurrency(data.summary.bookedWorkNext8Weeks)} booked across 8 weeks`,
      accent: "pine" as const,
      icon: <Clock className="h-5 w-5" />
    },
    {
      label: "Supplier invoices needing review",
      value: formatCount(data.summary.supplierInvoicesNeedingReview),
      hint: restrictedProfit
        ? "Restricted for staff roles"
        : `${data.summary.failedInvoiceReads} failed reads, ${data.summary.possibleDuplicateSupplierInvoices} possible duplicates`,
      accent: "coral" as const,
      icon: <FileWarning className="h-5 w-5" />
    }
  ];

  const warningRows = [
    ["Unmatched QuickBooks invoices", formatCount(data.summary.unmatchedQuickBooksInvoices)],
    ["Possible QuickBooks matches", formatCount(data.summary.possibleQuickBooksMatches)],
    ["Jobs with missing materials", formatCount(data.summary.jobsWithMissingMaterials)],
    ["Jobs with no time logged", formatCount(data.summary.jobsWithNoTimeLogged)],
    ["Unassigned supplier invoices", formatCount(data.summary.unassignedSupplierInvoices)],
    ["Material costs missing", formatCount(data.summary.materialCostsMissing)]
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <StatCard key={card.label} {...card} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.95fr]">
        <Panel title="Revenue, gross profit, and net profit trend" eyebrow="Performance">
          {restrictedProfit ? (
            <p className="text-sm text-slate-500">Financial trend reporting is restricted for staff users.</p>
          ) : (
            <OverviewTrendChart data={data.trend} showProfit />
          )}
        </Panel>

        <Panel title="Lead source revenue" eyebrow="Marketing">
          {restrictedProfit ? (
            <p className="text-sm text-slate-500">Lead source revenue is restricted for staff users.</p>
          ) : (
            <LeadSourceBarChart
              data={data.leadSources.map((source) => ({
                leadSource: source.leadSource,
                revenue: source.revenue
              }))}
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Data warnings" eyebrow="Needs review">
          <div className="grid gap-3 md:grid-cols-2">
            {warningRows.map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-600">{label}</p>
                  <AlertTriangle className="h-4 w-4 text-coral" />
                </div>
                <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
              </div>
            ))}
          </div>
        </Panel>

        {user.role !== "STAFF" ? (
          <Panel title="Integration health" eyebrow="Sync status">
            <div className="space-y-3">
              {data.syncConnections.map((connection) => (
                <div key={connection.provider} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{connection.provider.replace("_", " ")}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Last success: {connection.lastSuccessfulSyncAt ? new Date(connection.lastSuccessfulSyncAt).toLocaleString("en-GB") : "Not synced yet"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusPill value={connection.mode} />
                      <StatusPill value={connection.status || "Unknown"} />
                    </div>
                  </div>
                  {connection.lastError ? <p className="mt-3 text-sm text-coral">{connection.lastError}</p> : null}
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
