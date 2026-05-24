export function LoadingBlock({ label = "Loading dashboard data..." }: { label?: string }) {
  return (
    <div className="rounded-lg border border-white/70 bg-white/80 p-8 shadow-panel backdrop-blur">
      <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
      <div className="mt-4 h-10 w-full animate-pulse rounded-md bg-slate-100" />
      <p className="mt-6 text-sm text-slate-500">{label}</p>
    </div>
  );
}
