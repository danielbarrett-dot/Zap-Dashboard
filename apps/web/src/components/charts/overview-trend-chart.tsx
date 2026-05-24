"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCurrency } from "@/lib/format";

export function OverviewTrendChart({
  data,
  showProfit
}: {
  data: Array<{ month: string; revenue: number; grossProfit: number | null; netProfit: number | null; labourHours: number }>;
  showProfit: boolean;
}) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#12747c" stopOpacity={0.35} />
              <stop offset="95%" stopColor="#12747c" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f3b93f" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#f3b93f" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#d6e2e7" />
          <XAxis dataKey="month" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip
            formatter={(value: number, name: string) => [formatCurrency(value), name]}
            contentStyle={{
              borderRadius: 16,
              border: "1px solid rgba(148, 163, 184, 0.2)",
              backgroundColor: "rgba(255,255,255,0.95)"
            }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#12747c" fill="url(#revenueGradient)" strokeWidth={3} />
          {showProfit ? (
            <>
              <Area type="monotone" dataKey="grossProfit" name="Gross profit" stroke="#f3b93f" fill="url(#profitGradient)" strokeWidth={3} />
              <Area type="monotone" dataKey="netProfit" name="Net profit" stroke="#f27059" fillOpacity={0} strokeWidth={2} />
            </>
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
