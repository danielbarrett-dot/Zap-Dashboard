"use client";

import useSWR from "swr";

import { LoadingBlock } from "@/components/loading-block";
import { MatchWorkbench } from "@/components/matches/match-workbench";
import { Panel } from "@/components/panel";
import { apiFetcher } from "@/lib/api";
import { useCurrentUser } from "@/lib/hooks";
import type { MatchesResponse } from "@/types";

export default function MatchesPage() {
  const { user } = useCurrentUser();
  const { data, isLoading, mutate } = useSWR<MatchesResponse>(
    user && user.role !== "STAFF" ? "/matches" : null,
    apiFetcher
  );

  if (!user || isLoading) {
    return <LoadingBlock label="Loading job and invoice matching..." />;
  }

  if (user.role === "STAFF") {
    return (
      <Panel title="Job and invoice matching" eyebrow="Restricted">
        <p className="text-sm text-slate-500">
          Matching is limited because it directly affects revenue attribution.
        </p>
      </Panel>
    );
  }

  if (!data) {
    return <LoadingBlock label="Loading job and invoice matching..." />;
  }

  return (
    <div className="space-y-6">
      <Panel title="Job and invoice matching" eyebrow="Reference + customer fallback">
        <p className="max-w-3xl text-sm text-slate-500">
          Revenue is attached to jobs through automatic matching on the QuickBooks reference first, customer name second, and cautious fuzzy matching for review. Possible matches stay out of confirmed reporting until checked.
        </p>
      </Panel>

      <MatchWorkbench data={data} role={user.role} onRefresh={() => void mutate()} />
    </div>
  );
}
