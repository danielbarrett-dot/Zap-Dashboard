import type { ReactNode } from "react";

type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  accent?: "amber" | "teal" | "coral" | "pine";
  icon?: ReactNode;
};

const accentClass: Record<NonNullable<StatCardProps["accent"]>, string> = {
  amber: "from-amber/25 to-amber/5",
  teal: "from-teal/25 to-teal/5",
  coral: "from-coral/25 to-coral/5",
  pine: "from-pine/25 to-pine/5"
};

export function StatCard({ label, value, hint, accent = "teal", icon }: StatCardProps) {
  return (
    <div
      className={`rounded-lg border border-white/80 bg-gradient-to-br ${accentClass[accent]} p-5 shadow-panel`}
    >
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        {icon ? <div className="text-ink/70">{icon}</div> : null}
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-ink">{value}</p>
      {hint ? <p className="mt-3 text-sm text-slate-500">{hint}</p> : null}
    </div>
  );
}
