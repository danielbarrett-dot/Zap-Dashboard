"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";

import { LoadingBlock } from "@/components/loading-block";
import { Panel } from "@/components/panel";
import { StatCard } from "@/components/stat-card";
import { apiFetcher } from "@/lib/api";
import { formatCurrency, formatPercent } from "@/lib/format";
import { useCurrentUser } from "@/lib/hooks";
import type { PnlResponse } from "@/types";

export default function PnlPage() {
  const { user } = useCurrentUser();
  const { data, isLoading } = useSWR<PnlResponse>(user && user.role !== "STAFF" ? "/dashboard/pnl" : null, apiFetcher);

  if (!user || isLoading) {
    return <LoadingBlock label="Loading P&L dashboard..." />;
  }

  if (user.role === "STAFF") {
    return <Panel title="P&L dashboard" eyebrow="Restricted"><p className="text-sm text-slate-500">Staff users cannot view company financial performance.</p></Panel>;
  }

  if (!data) {
    return <LoadingBlock label="Loading P&L dashboard..." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Revenue ex VAT" value={formatCurrency(data.summary.revenueExVat)} />
        <StatCard label="Gross profit" value={formatCurrency(data.summary.grossProfit)} hint={`${formatPercent(data.summary.grossMargin)} margin`} accent="pine" />
        <StatCard label="Overheads" value={formatCurrency(data.summary.overheads)} accent="amber" />
        <StatCard label="Net profit before tax" value={formatCurrency(data.summary.netProfitBeforeTax)} hint={`${formatPercent(data.summary.netMargin)} net margin`} accent="coral" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.9fr]">
        <Panel title="Monthly P&L trend" eyebrow="QuickBooks transaction dates">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6e2e7" />
                <XAxis dataKey="month" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip formatter={(value: number) => [formatCurrency(value), ""]} />
                <Area dataKey="revenueExVat" name="Revenue" stroke="#12747c" fill="#12747c" fillOpacity={0.15} strokeWidth={3} />
                <Area dataKey="netProfitBeforeTax" name="Net profit" stroke="#f27059" fill="#f27059" fillOpacity={0.12} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title="Expense categories" eyebrow="Mapped QuickBooks accounts">
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.categories}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d6e2e7" />
                <XAxis dataKey="dashboardCategory" stroke="#64748b" hide />
                <YAxis stroke="#64748b" />
                <Tooltip formatter={(value: number, _name, item) => [formatCurrency(value), String(item.payload.dashboardCategory).replaceAll("_", " ")]} />
                <Bar dataKey="amountExVat" fill="#f3b93f" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <Panel title="Category breakdown" eyebrow="Ex VAT">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left">
            <thead>
              <tr className="text-xs uppercase tracking-[0.18em] text-slate-500">
                <th className="pb-3 pr-4 font-semibold">Category</th>
                <th className="pb-3 font-semibold">Amount ex VAT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.categories.map((row) => (
                <tr key={row.dashboardCategory} className="text-sm text-slate-700">
                  <td className="py-4 pr-4 font-semibold text-ink">{row.dashboardCategory.replaceAll("_", " ")}</td>
                  <td className="py-4">{formatCurrency(row.amountExVat)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
