"use client";

import { LogOut, ShieldCheck, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

import { apiFetch, apiFetcher } from "@/lib/api";
import type { AuthUser, SyncStatusResponse } from "@/types";

export function Topbar({ user }: { user: AuthUser }) {
  const router = useRouter();
  const { data: syncStatus } = useSWR<SyncStatusResponse>(
    user.role !== "STAFF" ? "/sync/status" : null,
    apiFetcher
  );

  const handleLogout = async () => {
    await apiFetch("/auth/logout", {
      method: "POST"
    });
    router.replace("/login");
    router.refresh();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/80 bg-white/90 px-6 py-4 shadow-panel backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-teal">Secure internal workspace</p>
        <div className="mt-2 flex items-center gap-3">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">Operational control room</h2>
          <span className="inline-flex items-center gap-2 rounded-md bg-pine/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-pine">
            <ShieldCheck className="h-3.5 w-3.5" />
            Role {user.role}
          </span>
        </div>
        {syncStatus ? (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {syncStatus.connections
              .filter((connection) => connection.provider === "SERVICEM8" || connection.provider === "QUICKBOOKS")
              .map((connection) => (
                <span key={connection.provider}>
                  {connection.provider}: {connection.lastSuccessfulSyncAt ? new Date(connection.lastSuccessfulSyncAt).toLocaleString("en-GB") : "not synced"} · {connection.mode}
                </span>
              ))}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden rounded-md bg-amber/20 px-4 py-2 text-sm font-medium text-ink md:flex md:items-center md:gap-2">
          <Zap className="h-4 w-4 text-coral" />
          {user.email}
        </div>
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}
