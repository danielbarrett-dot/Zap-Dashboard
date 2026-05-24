"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { formatCurrency } from "@/lib/format";

export function LeadSourceBarChart({
  data
}: {
  data: Array<{ leadSource: string; revenue: number }>;
}) {
  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#d6e2e7" />
          <XAxis dataKey="leadSource" stroke="#64748b" />
          <YAxis stroke="#64748b" />
          <Tooltip
            formatter={(value: number) => [formatCurrency(value), "Revenue"]}
            contentStyle={{
              borderRadius: 16,
              border: "1px solid rgba(148, 163, 184, 0.2)",
              backgroundColor: "rgba(255,255,255,0.95)"
            }}
          />
          <Bar dataKey="revenue" fill="#12747c" radius={[10, 10, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

