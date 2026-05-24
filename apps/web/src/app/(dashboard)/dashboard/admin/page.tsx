"use client";

import useSWR from "swr";

import { LoadingBlock } from "@/components/loading-block";
import { Panel } from "@/components/panel";
import { StatusPill } from "@/components/status-pill";
import { apiFetcher } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCurrentUser } from "@/lib/hooks";
import type { AdminSettingsResponse } from "@/types";

export default function AdminPage() {
  const { user } = useCurrentUser();
  const { data, isLoading } = useSWR<AdminSettingsResponse>(user && user.role !== "STAFF" ? "/admin/settings" : null, apiFetcher);

  if (!user || isLoading) {
    return <LoadingBlock label="Loading admin settings..." />;
  }

  if (user.role === "STAFF" || !data) {
    return <Panel title="Admin settings" eyebrow="Restricted"><p className="text-sm text-slate-500">This area is restricted.</p></Panel>;
  }

  return (
    <div className="space-y-6">
      <Panel title="Integration settings" eyebrow="Connection health and mock mode">
        <div className="grid gap-3 md:grid-cols-3">
          {data.connections.map((connection) => (
            <div key={connection.provider} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-ink">{connection.provider.replace("_", " ")}</p>
                <StatusPill value={connection.mode} />
              </div>
              <p className="mt-2 text-sm text-slate-500">Status: {connection.status || "Unknown"}</p>
              <p className="mt-1 text-sm text-slate-500">Last success: {formatDate(connection.lastSuccessfulSyncAt)}</p>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="User access" eyebrow="Roles and permissions">
          <div className="space-y-3">
            {data.users.map((account) => (
              <div key={account.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{account.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{account.email}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                      Last login {formatDate(account.lastLoginAt)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <StatusPill value={account.role} />
                    <StatusPill value={account.isActive ? "ACTIVE" : "INACTIVE"} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Staff hourly rates" eyebrow="Used for after-labour profitability">
          <div className="space-y-3">
            {data.staff.map((staff) => (
              <div key={staff.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{staff.name}</p>
                    <p className="text-sm text-slate-500">{staff.email || "No email"} · {staff.active ? "Active" : "Inactive"}</p>
                  </div>
                  <p className="font-semibold text-ink">{formatCurrency(Number(staff.hourlyCostRate || 0))}/h</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="QuickBooks P&L mappings" eyebrow="Dashboard categories">
          <div className="space-y-3">
            {data.quickBooksCategoryMappings.map((mapping) => (
              <div key={mapping.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-ink">{mapping.quickBooksAccountName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {mapping.quickBooksAccountType} → {mapping.dashboardCategory.replaceAll("_", " ")}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Recent sync logs" eyebrow="Reliability">
          <div className="space-y-3">
            {data.syncLogs.map((run) => (
              <div key={String(run.id)} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-ink">{String(run.source || run.provider)}</p>
                  <StatusPill value={String(run.status)} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{formatDate(String(run.startedAt))}</p>
                {run.errorMessage ? <p className="mt-2 text-sm text-coral">{run.errorMessage}</p> : null}
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Audit logs" eyebrow="Manual changes and admin activity">
          <div className="space-y-3">
            {data.auditLogs.map((log) => (
              <div key={String(log.id)} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="font-semibold text-ink">{String(log.action)}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {String(log.entityType)} · {formatDate(String(log.createdAt))}
                </p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
